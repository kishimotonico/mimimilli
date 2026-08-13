import { readFileSync } from "node:fs";
import type { ScanDiagnostic, Work } from "@mimimilli/shared";
import type { Db } from "./db.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { UserWorkStateRepository } from "./userWorkStateRepository.ts";
import type { CoverColumns } from "./workRowMapping.ts";
import { computeSourceRevision, type WorkRevisions } from "./fingerprint.ts";

interface UpsertItem {
  work: Work;
  revisions: WorkRevisions;
  cover: CoverColumns;
  metaPath: string;
}

interface WorkError {
  id: string;
  physicalPath: string;
  metaPath: string;
  message: string;
}

/** scan中はcatalogへ書かず、完成した世代だけを最後に公開する。 */
export class ScanUpsertBatch {
  private readonly queue: UpsertItem[] = [];
  private readonly errors: WorkError[] = [];
  private readonly db: Db;
  private readonly catalog: CatalogWorkRepository;
  private readonly user: UserWorkStateRepository;
  private readonly checkAbort: () => void;

  constructor(
    db: Db,
    catalog: CatalogWorkRepository,
    user: UserWorkStateRepository,
    checkAbort: () => void = () => {},
  ) {
    this.db = db;
    this.catalog = catalog;
    this.user = user;
    this.checkAbort = checkAbort;
  }

  add(work: Work, revisions: WorkRevisions, cover: CoverColumns, metaPath: string): void {
    this.queue.push({ work, revisions, cover, metaPath });
  }

  addError(id: string, physicalPath: string, metaPath: string, message: string): void {
    this.errors.push({ id, physicalPath, metaPath, message });
  }

  /** staging後にsidecarが変わった作品は今回の世代から除外する。 */
  discardChangedSources(): string[] {
    const changed: string[] = [];
    const retained = this.queue.filter((item) => {
      try {
        if (computeSourceRevision(readFileSync(item.metaPath)) === item.revisions.sourceRevision) {
          return true;
        }
      } catch {
        // 消失・読取失敗も今回の投影対象から外し、旧世代を残す。
      }
      changed.push(item.work.id);
      return false;
    });
    this.queue.length = 0;
    this.queue.push(...retained);
    return changed;
  }

  publishWork(): void {
    this.checkAbort();
    this.db.userTransaction(() => {
      for (const item of this.queue) this.user.upsertWorkUserState(item.work);
    });
    this.checkAbort();
    this.db.transaction(() => {
      this.checkAbort();
      for (const item of this.queue) {
        this.catalog.upsertWorkCatalog(item.work, {
          metaPath: item.metaPath,
          revisions: item.revisions,
          cover: item.cover,
        });
      }
      for (const error of this.errors) {
        this.catalog.markWorkError(error.id, error.physicalPath, error.metaPath, error.message);
      }
    });
  }

  publishScanGeneration(input: {
    seenIds: string[];
    unverifiedIds: string[];
    diagnostics: ScanDiagnostic[];
  }): void {
    this.checkAbort();
    this.db.userTransaction(() => {
      for (const item of this.queue) this.user.upsertWorkUserState(item.work);
    });
    this.checkAbort();
    this.db.transaction(() => {
      this.checkAbort();
      for (const item of this.queue) {
        this.catalog.upsertWorkCatalog(item.work, {
          metaPath: item.metaPath,
          revisions: item.revisions,
          cover: item.cover,
        });
      }
      for (const error of this.errors) {
        this.catalog.markWorkError(error.id, error.physicalPath, error.metaPath, error.message);
      }
      this.catalog.replaceIdentityConflicts(input.diagnostics);
      this.catalog.markMissingExcept(input.seenIds, input.unverifiedIds);
    });
  }
}
