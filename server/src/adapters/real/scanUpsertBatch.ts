import type { Work } from "@mimimilli/shared";
import type { Db } from "./db.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { UserWorkStateRepository } from "./userWorkStateRepository.ts";
import type { CoverColumns } from "./workRowMapping.ts";

interface UpsertItem {
  work: Work;
  fingerprint: string;
  cover: CoverColumns;
  metaPath: string;
}

/** upsertWork の呼び出しを一定件数ごとに user・catalog 各DBのトランザクションでまとめる。
 *  user を先にコミットしてから catalog を書く（ADR-0008）。2DBは別ファイルのため集合としては原子的ではない。 */
export class ScanUpsertBatch {
  private queue: UpsertItem[] = [];
  private readonly db: Db;
  private readonly catalog: CatalogWorkRepository;
  private readonly user: UserWorkStateRepository;
  private readonly limit: number;
  private readonly checkAbort: () => void;

  constructor(
    db: Db,
    catalog: CatalogWorkRepository,
    user: UserWorkStateRepository,
    limit: number,
    checkAbort: () => void = () => {},
  ) {
    this.db = db;
    this.catalog = catalog;
    this.user = user;
    this.limit = limit;
    this.checkAbort = checkAbort;
  }

  add(work: Work, fingerprint: string, cover: CoverColumns, metaPath: string): void {
    this.queue.push({ work, fingerprint, cover, metaPath });
    if (this.queue.length >= this.limit) {
      this.checkAbort();
      this.flush();
    }
  }

  flush(): void {
    this.checkAbort();
    if (this.queue.length === 0) return;
    const items = this.queue;
    this.db.userTransaction(() => {
      for (const item of items) {
        this.checkAbort();
        this.user.upsertWorkUserState(item.work);
      }
    });
    this.checkAbort();
    this.db.transaction(() => {
      for (const item of items) {
        this.checkAbort();
        this.catalog.upsertWorkCatalog(item.work, {
          metaPath: item.metaPath,
          fingerprint: item.fingerprint,
          cover: item.cover,
        });
      }
    });
    this.queue = [];
  }
}
