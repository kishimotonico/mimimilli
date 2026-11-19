import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import type {
  ScanCandidate,
  ScanCandidateFolder,
  ScanCandidateMissingWork,
  ScanCandidateRegisterItem,
  ScanCandidatesRegisterResponse,
} from "@mimimilli/shared";
import { CandidatePoolChangedError } from "../../errors.ts";
import { folderTarget } from "./registrationTarget.ts";
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

  /** 直したコードがあればそれ、なければ検出したコード。直して「なし」にしたときは空文字で明示する */
  private registrationRjCode(folder: ScanCandidateFolder): string | undefined {
    if (this.rjCodeOverrides.has(folder.path)) return this.rjCodeOverrides.get(folder.path) ?? "";
    return folder.detectedRjCode ?? undefined;
  }

  private listFolders(
    user: Pick<UserWorkStateRepository, "listScanCandidateExclusions">,
  ): ScanCandidateFolder[] {
    const excluded = new Set(user.listScanCandidateExclusions());
    return this.pool.filter((folder) => !excluded.has(folder.path));
  }

  private toCandidate(folder: ScanCandidateFolder, context: CandidateListContext): ScanCandidate {
    const rjCode = this.effectiveRjCode(folder);
    return {
      path: folder.path,
      inferredTitle: folder.inferredTitle,
      audioFileCount: folder.audioFileCount,
      audioBreakdown: folder.audioBreakdown,
      rjCode,
      dlsite: deriveCandidateDlsite(context.dlsite, rjCode),
      missingWorks: rjCode ? (context.missingWorksByRjCode.get(rjCode) ?? []) : [],
    };
  }

  listCandidates(
    user: Pick<UserWorkStateRepository, "listScanCandidateExclusions">,
    context: CandidateListContext,
  ): ScanCandidate[] {
    return this.listFolders(user).map((folder) => this.toCandidate(folder, context));
  }

  /** nullはRJコードなしの明示。検出値と同じ値に直したときは直した記録を残さない */
  setRjCode(
    root: string,
    path: string,
    rjCode: string | null,
    user: Pick<UserWorkStateRepository, "listScanCandidateExclusions">,
    context: CandidateListContext,
  ): ScanCandidate {
    this.assertRootMatches(root);
    const folder = this.listFolders(user).find((candidate) => candidate.path === path);
    if (!folder) throw new CandidatePoolChangedError();
    if (rjCode === folder.detectedRjCode) this.rjCodeOverrides.delete(folder.path);
    else this.rjCodeOverrides.set(folder.path, rjCode);
    return this.toCandidate(folder, context);
  }

  async registerCandidates(
    root: string,
    items: ScanCandidateRegisterItem[],
    scanner: Scanner,
    user: Pick<UserWorkStateRepository, "listScanCandidateExclusions">,
  ): Promise<ScanCandidatesRegisterResponse> {
    this.assertRootMatches(root);
    const byPath = new Map<string, ScanCandidateFolder>(
      this.listFolders(user).map((folder) => [folder.path, folder]),
    );
    const selected = items.map((item) => ({ item, folder: byPath.get(item.path) }));
    if (selected.some((entry) => entry.folder === undefined)) {
      throw new CandidatePoolChangedError();
    }
    const registered: ScanCandidatesRegisterResponse["registered"] = [];
    const failures: ScanCandidatesRegisterResponse["failures"] = [];
    for (const { folder } of selected) {
      const current = folder!;
      try {
        const outcome = await scanner.registerWork(folderTarget(resolve(root, current.path)), {
          title: current.inferredTitle,
          rjCode: this.registrationRjCode(current),
        });
        registered.push({ path: current.path, workId: outcome.snapshot.meta.id });
      } catch (error) {
        failures.push({
          path: current.path,
          message: error instanceof Error ? error.message : "候補の登録に失敗しました",
        });
      }
    }
    const registeredPaths = new Set(registered.map((entry) => entry.path));
    this.pool = this.pool.filter((folder) => !registeredPaths.has(folder.path));
    for (const path of registeredPaths) this.rjCodeOverrides.delete(path);
    return { registered, failures };
  }

  async excludeCandidates(
    root: string,
    paths: string[],
    user: Pick<UserWorkStateRepository, "listScanCandidateExclusions" | "excludeScanCandidates">,
  ): Promise<void> {
    this.assertRootMatches(root);
    const currentPaths = new Set<string>(this.listFolders(user).map((folder) => folder.path));
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
