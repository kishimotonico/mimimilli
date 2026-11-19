import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import type {
  DlsiteRegistrationApply,
  DlsiteWorkInfo,
  ScanCandidate,
  ScanCandidateFolder,
  ScanCandidateMissingWork,
  ScanCandidatesRegisterResponse,
} from "@mimimilli/shared";
import { CandidatePoolChangedError } from "../../errors.ts";
import { planDlsiteRegistration } from "@mimimilli/shared";
import { saveWithDlsiteCover } from "./dlsiteCoverStaging.ts";
import type { DlsiteCache } from "./dlsiteCache.ts";
import { ancestorFolderIsRegistered, folderTarget } from "./registrationTarget.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import { deriveCandidateDlsite, type CandidateDlsiteSource } from "./scanCandidateDlsite.ts";
import type { Scanner } from "./scanner.ts";
import type { UserWorkStateRepository } from "./userWorkStateRepository.ts";

function resolveRootFingerprint(root: string): string {
  return realpathSync(resolve(root));
}

/** root消失（削除・アンマウント等）を「プールがstale」として扱うための実行時解決。
 *  ENOENT等はnullへ変換し、assertRootMatches側でCandidatePoolChangedErrorにする */
function tryResolveRootFingerprint(root: string): string | null {
  try {
    return resolveRootFingerprint(root);
  } catch {
    return null;
  }
}

export interface CandidateStores {
  user: Pick<UserWorkStateRepository, "listScanCandidateExclusions">;
  query: Pick<WorkQueryRepository, "listWorkPhysicalPaths">;
}

/** 候補一覧を組み立てるときに読むもの */
export interface CandidateListContext {
  dlsite: CandidateDlsiteSource;
  missingWorksByRjCode: ReadonlyMap<string, ScanCandidateMissingWork[]>;
}

/** 直近スキャン由来の候補プール。worker 完了時はインスタンスごと置き換える。
 *  直したRJコードはこのセッションだけが持ち、次のスキャンかサーバー再起動で破棄される。 */
export class ScanCandidateSession {
  private pool: ScanCandidateFolder[];
  private readonly rootFingerprint: string | null;
  /** 値がnullのエントリはRJコードなしの明示 */
  private readonly rjCodeOverrides = new Map<string, string | null>();

  private constructor(pool: ScanCandidateFolder[], rootFingerprint: string | null) {
    this.pool = pool;
    this.rootFingerprint = rootFingerprint;
  }

  static fromPool(pool: ScanCandidateFolder[], root: string): ScanCandidateSession {
    return new ScanCandidateSession(pool, resolveRootFingerprint(root));
  }

  static empty(): ScanCandidateSession {
    return new ScanCandidateSession([], null);
  }

  private assertRootMatches(currentRoot: string): void {
    if (this.rootFingerprint === null) {
      throw new CandidatePoolChangedError();
    }
    if (tryResolveRootFingerprint(currentRoot) !== this.rootFingerprint) {
      throw new CandidatePoolChangedError();
    }
  }

  private effectiveRjCode(folder: ScanCandidateFolder): string | null {
    return this.rjCodeOverrides.has(folder.path)
      ? (this.rjCodeOverrides.get(folder.path) ?? null)
      : folder.detectedRjCode;
  }

  /** 直して「なし」にしたときは空文字で明示する。検出も上書きもなければnull */
  private registrationRjCode(folder: ScanCandidateFolder): string | null {
    if (this.rjCodeOverrides.has(folder.path)) return this.rjCodeOverrides.get(folder.path) ?? "";
    return folder.detectedRjCode;
  }

  /** 除外と、catalogに登録済み（自分自身か祖先フォルダー）の候補を除く。登録状況の正はcatalog */
  private listFolders(root: string, stores: CandidateStores): ScanCandidateFolder[] {
    const excluded = new Set(stores.user.listScanCandidateExclusions());
    const registered = stores.query.listWorkPhysicalPaths();
    const isRegistered = (path: string) => registered.has(path);
    return this.pool.filter((folder) => {
      if (excluded.has(folder.path)) return false;
      const physicalPath = resolve(root, folder.path);
      return (
        !isRegistered(physicalPath) && !ancestorFolderIsRegistered(isRegistered, physicalPath, root)
      );
    });
  }

  private toCandidate(folder: ScanCandidateFolder, context: CandidateListContext): ScanCandidate {
    const rjCode = this.effectiveRjCode(folder);
    return {
      path: folder.path,
      inferredTitle: folder.inferredTitle,
      audioFileCount: folder.audioFileCount,
      audioBreakdown: folder.audioBreakdown,
      rjCode,
      rjCodeEdited: this.rjCodeOverrides.has(folder.path),
      dlsite: deriveCandidateDlsite(context.dlsite, rjCode),
      missingWorks: rjCode ? (context.missingWorksByRjCode.get(rjCode) ?? []) : [],
    };
  }

  listCandidates(
    root: string,
    stores: CandidateStores,
    context: CandidateListContext,
  ): ScanCandidate[] {
    return this.listFolders(root, stores).map((folder) => this.toCandidate(folder, context));
  }

  /** nullはRJコードなしの明示。検出値と同じ値に直したときは直した記録を残さない */
  setRjCode(
    root: string,
    path: string,
    rjCode: string | null,
    stores: CandidateStores,
    context: CandidateListContext,
  ): ScanCandidate {
    this.assertRootMatches(root);
    const folder = this.listFolders(root, stores).find((candidate) => candidate.path === path);
    if (!folder) throw new CandidatePoolChangedError();
    if (rjCode === folder.detectedRjCode) this.rjCodeOverrides.delete(folder.path);
    else this.rjCodeOverrides.set(folder.path, rjCode);
    return this.toCandidate(folder, context);
  }

  async registerCandidates(
    root: string,
    paths: string[],
    apply: DlsiteRegistrationApply,
    deps: {
      scanner: Scanner;
      stores: CandidateStores;
      dlsiteCache: Pick<DlsiteCache, "getCover">;
      readUsableInfo: (productCode: string) => DlsiteWorkInfo | null;
    },
  ): Promise<ScanCandidatesRegisterResponse> {
    this.assertRootMatches(root);
    const byPath = new Map<string, ScanCandidateFolder>(
      this.listFolders(root, deps.stores).map((folder) => [folder.path, folder]),
    );
    const selected = paths.map((path) => byPath.get(path));
    if (selected.some((folder) => folder === undefined)) {
      throw new CandidatePoolChangedError();
    }
    const registered: ScanCandidatesRegisterResponse["registered"] = [];
    const failures: ScanCandidatesRegisterResponse["failures"] = [];
    for (const folder of selected as ScanCandidateFolder[]) {
      try {
        const target = folderTarget(resolve(root, folder.path));
        const rjCode = this.registrationRjCode(folder);
        const plan = planDlsiteRegistration({
          rjCode,
          info: rjCode ? deps.readUsableInfo(rjCode) : null,
          title: folder.inferredTitle,
          tags: [],
          apply,
        });
        const prepared = await saveWithDlsiteCover(
          { cache: deps.dlsiteCache, coverUrl: plan.coverUrl },
          target.placement,
          root,
          (cover) => {
            cover?.place();
            return deps.scanner.writeNewWorkMeta(target, {
              title: plan.title,
              tags: plan.tags,
              urls: plan.dlsiteUrl ? [plan.dlsiteUrl] : [],
              coverImage: cover?.fileName,
              dlsite: plan.dlsite,
            });
          },
        );
        const outcome = await deps.scanner.projectPrepared(prepared);
        registered.push({ path: folder.path, workId: outcome.snapshot.meta.id });
      } catch (error) {
        failures.push({
          path: folder.path,
          message: error instanceof Error ? error.message : "候補の登録に失敗しました",
        });
      }
    }
    const registeredPaths = new Set(registered.map((entry) => entry.path));
    for (const path of registeredPaths) this.rjCodeOverrides.delete(path);
    return { registered, failures };
  }

  async excludeCandidates(
    root: string,
    paths: string[],
    stores: CandidateStores,
    user: Pick<UserWorkStateRepository, "excludeScanCandidates">,
  ): Promise<void> {
    this.assertRootMatches(root);
    const currentPaths = new Set<string>(
      this.listFolders(root, stores).map((folder) => folder.path),
    );
    if (paths.some((path) => !currentPaths.has(path))) {
      throw new CandidatePoolChangedError();
    }
    user.excludeScanCandidates(paths);
  }

  listExcludedCandidates(
    user: Pick<UserWorkStateRepository, "listScanCandidateExclusions">,
  ): string[] {
    return user.listScanCandidateExclusions();
  }

  restoreExcludedCandidates(
    paths: string[],
    user: Pick<UserWorkStateRepository, "restoreScanCandidateExclusions">,
  ): void {
    user.restoreScanCandidateExclusions(paths);
  }
}
