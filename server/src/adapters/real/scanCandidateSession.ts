import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import type {
  ScanCandidate,
  ScanCandidateRegisterItem,
  ScanCandidatesRegisterResponse,
} from "@mimimilli/shared";
import { CandidatePoolChangedError } from "../../errors.ts";
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

/** 直近スキャン由来の候補プール。worker 完了時はインスタンスごと置き換える。 */
export class ScanCandidateSession {
  private pool: ScanCandidate[];
  private readonly rootFingerprint: string | null;

  private constructor(pool: ScanCandidate[], rootFingerprint: string | null) {
    this.pool = pool;
    this.rootFingerprint = rootFingerprint;
  }

  static fromPool(pool: ScanCandidate[], root: string): ScanCandidateSession {
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

  listCandidates(
    user: Pick<UserWorkStateRepository, "listScanCandidateExclusions">,
  ): ScanCandidate[] {
    const excluded = new Set(user.listScanCandidateExclusions());
    return this.pool.filter((candidate) => !excluded.has(candidate.path));
  }

  async registerCandidates(
    root: string,
    items: ScanCandidateRegisterItem[],
    scanner: Scanner,
    user: Pick<UserWorkStateRepository, "listScanCandidateExclusions">,
    onRegistered: (workId: string) => void = () => {},
  ): Promise<ScanCandidatesRegisterResponse> {
    this.assertRootMatches(root);
    const candidates = this.listCandidates(user);
    const byPath = new Map<string, ScanCandidate>(
      candidates.map((candidate) => [candidate.path, candidate]),
    );
    const selected = items.map((item) => ({ item, candidate: byPath.get(item.path) }));
    if (selected.some((entry) => entry.candidate === undefined)) {
      throw new CandidatePoolChangedError();
    }
    const registered: ScanCandidatesRegisterResponse["registered"] = [];
    const failures: ScanCandidatesRegisterResponse["failures"] = [];
    for (const { item, candidate } of selected) {
      const current = candidate!;
      try {
        const work = await scanner.registerFolderWork(resolve(root, current.path), {
          title: current.inferredTitle,
          rjCode: item.rjCode,
        });
        registered.push({ path: current.path, workId: work.id });
        onRegistered(work.id);
      } catch (error) {
        failures.push({
          path: current.path,
          message: error instanceof Error ? error.message : "候補の登録に失敗しました",
        });
      }
    }
    const registeredPaths = new Set(registered.map((entry) => entry.path));
    this.pool = this.pool.filter((candidate) => !registeredPaths.has(candidate.path));
    return { registered, failures };
  }

  async excludeCandidates(
    root: string,
    paths: string[],
    user: Pick<UserWorkStateRepository, "listScanCandidateExclusions" | "excludeScanCandidates">,
  ): Promise<void> {
    this.assertRootMatches(root);
    const currentPaths = new Set(this.listCandidates(user).map((candidate) => candidate.path));
    if (paths.some((path) => !currentPaths.has(path as ScanCandidate["path"]))) {
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
