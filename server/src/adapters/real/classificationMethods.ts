import {
  DEFAULT_TAG_PREFIXES,
  type AxisFacetItem,
  type SmartFolder,
  type SmartFolderCreate,
  type SmartFolderUpdate,
  type TagPrefix,
  type TagPrefixCandidate,
  type TagPrefixCreate,
  type TagPrefixUpdate,
  type WorksPage,
} from "@mimimilli/shared";
import type { AxisFacetsQuery, SmartFolderEvalQuery } from "@mimimilli/shared";
import { buildTagPrefixCandidates } from "../../core/tagPrefixCandidates.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import { logDataIntegritySkips } from "./dataIntegrity.ts";
import type { UserWorkStateRepository } from "./userWorkStateRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import { querySmartFolderWorks } from "./smartFolderWorks.ts";

const scanLogger = getCategoryLogger("scan");
const KEY_TAG_PREFIXES_SEEDED = "tag_prefixes_seeded";

export function initializeTagPrefixes(user: UserWorkStateRepository): void {
  if (user.getUserSetting(KEY_TAG_PREFIXES_SEEDED) === null) {
    for (const def of DEFAULT_TAG_PREFIXES) user.createTagPrefix(def);
    user.setUserSetting(KEY_TAG_PREFIXES_SEEDED, "1");
  }
}

export function createClassificationMethods(deps: {
  query: WorkQueryRepository;
  user: UserWorkStateRepository;
}) {
  const { query, user } = deps;
  return {
    async getAxisFacets(axis: string, filter?: Partial<AxisFacetsQuery>): Promise<AxisFacetItem[]> {
      return query.getAxisFacets(axis, filter);
    },

    async listTagPrefixes(): Promise<TagPrefix[]> {
      return user.listTagPrefixes();
    },
    async createTagPrefix(input: TagPrefixCreate): Promise<TagPrefix | null> {
      return user.createTagPrefix(input);
    },
    async updateTagPrefix(prefix: string, patch: TagPrefixUpdate): Promise<TagPrefix | null> {
      return user.updateTagPrefix(prefix, patch);
    },
    async deleteTagPrefix(prefix: string): Promise<boolean> {
      return user.deleteTagPrefix(prefix);
    },
    async listTagPrefixCandidates(): Promise<TagPrefixCandidate[]> {
      const { summaries, skipped } = query.listSummaries();
      logDataIntegritySkips(scanLogger, "tag-prefix-candidates", skipped);
      return buildTagPrefixCandidates(
        summaries,
        user.listTagPrefixes().map((p) => p.prefix),
      );
    },

    async listSmartFolders(): Promise<SmartFolder[]> {
      return user.listSmartFolders();
    },
    async createSmartFolder(input: SmartFolderCreate): Promise<SmartFolder> {
      return user.createSmartFolder(input);
    },
    async updateSmartFolder(id: string, input: SmartFolderUpdate): Promise<SmartFolder | null> {
      return user.updateSmartFolder(id, input);
    },
    async deleteSmartFolder(id: string): Promise<boolean> {
      return user.deleteSmartFolder(id);
    },
    async evalSmartFolder(id: string, evalQuery: SmartFolderEvalQuery): Promise<WorksPage | null> {
      const folder = user.getSmartFolder(id);
      if (!folder) return null;
      return querySmartFolderWorks(query, folder, evalQuery);
    },
  };
}
