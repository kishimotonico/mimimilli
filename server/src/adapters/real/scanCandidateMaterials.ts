import { existsSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  META_FILE_NAME,
  planDlsiteRegistration,
  type DlsiteWorkInfo,
  type ScanCandidateFolder,
} from "@mimimilli/shared";
import type {
  CandidateAvailability,
  CandidateDescriber,
  SettingsAdapter,
} from "../../adapter/index.ts";
import { saveWithDlsiteCover } from "./dlsiteCoverStaging.ts";
import type { DlsiteCache } from "./dlsiteCache.ts";
import { ancestorFolderIsRegistered, folderTarget } from "./registrationTarget.ts";
import {
  deriveCandidateDlsite,
  groupMissingWorksByRjCode,
  type CandidateDlsiteSource,
} from "./scanCandidateDlsite.ts";
import type { Scanner } from "./scanner.ts";
import type { UserWorkStateRepository } from "./userWorkStateRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";

export function resolveRootIdentity(root: string): string {
  return realpathSync(resolve(root));
}

/** root消失（削除・アンマウント等）はnull。呼び出し側が候補プールの失効として扱う */
function tryResolveRootIdentity(root: string | null): string | null {
  if (root === null) return null;
  try {
    return resolveRootIdentity(root);
  } catch {
    return null;
  }
}

type CandidateMaterialMethods = Pick<
  SettingsAdapter,
  | "candidateRootIdentity"
  | "candidateAvailability"
  | "describeCandidates"
  | "registerCandidateFolder"
>;

/** スキャンの候補プールを組み立てるサーバー層が呼ぶ、候補の素材。規則はサーバー層が持つ */
export function createCandidateMaterials(deps: {
  getRoot: () => string | null;
  requireRoot: () => string;
  user: Pick<UserWorkStateRepository, "listScanCandidateExclusions">;
  query: Pick<WorkQueryRepository, "listWorkPhysicalPaths" | "listMissingWorksWithRjCode">;
  scanner: Scanner;
  dlsiteCache: Pick<DlsiteCache, "getCover">;
  candidateDlsite: CandidateDlsiteSource;
  readUsableInfo: (productCode: string) => DlsiteWorkInfo | null;
}): CandidateMaterialMethods {
  const { getRoot, requireRoot, user, query, scanner, dlsiteCache } = deps;
  return {
    async candidateRootIdentity(): Promise<string | null> {
      return tryResolveRootIdentity(getRoot());
    },

    async candidateAvailability(): Promise<CandidateAvailability> {
      const root = requireRoot();
      const excluded = new Set(user.listScanCandidateExclusions());
      const registered = query.listWorkPhysicalPaths();
      return (folder) => {
        if (excluded.has(folder.path)) return false;
        const physicalPath = resolve(root, folder.path);
        const isRegistered = (path: string) => registered.has(path);
        return (
          !isRegistered(physicalPath) &&
          !ancestorFolderIsRegistered(isRegistered, physicalPath, root) &&
          !existsSync(join(physicalPath, META_FILE_NAME))
        );
      };
    },

    async describeCandidates(): Promise<CandidateDescriber> {
      const missingWorksByRjCode = groupMissingWorksByRjCode(query.listMissingWorksWithRjCode());
      return (rjCode) => ({
        dlsite: deriveCandidateDlsite(deps.candidateDlsite, rjCode),
        missingWorks: rjCode ? (missingWorksByRjCode.get(rjCode) ?? []) : [],
      });
    },

    async registerCandidateFolder(folder: ScanCandidateFolder, rjCode, apply) {
      const root = requireRoot();
      const target = folderTarget(resolve(root, folder.path));
      const plan = planDlsiteRegistration({
        rjCode,
        info: rjCode ? deps.readUsableInfo(rjCode) : null,
        title: folder.inferredTitle,
        tags: [],
        apply,
      });
      const { value: prepared, coverSkipped } = await saveWithDlsiteCover(
        { cache: dlsiteCache, coverUrl: plan.coverUrl },
        target.placement,
        root,
        (cover) => {
          cover?.place();
          return scanner.writeNewWorkMeta(target, {
            title: plan.title,
            tags: plan.tags,
            urls: plan.dlsiteUrl ? [plan.dlsiteUrl] : [],
            coverImage: cover?.fileName,
            dlsite: plan.dlsite,
          });
        },
      );
      const outcome = await scanner.projectPrepared(prepared);
      return { workId: outcome.snapshot.meta.id, coverSkipped };
    },
  };
}
