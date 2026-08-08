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
import type { AxisFacetsFilter, SmartFolderEvalQuery } from "../../adapter.ts";
import { buildTagPrefixCandidates } from "../../core/tagPrefixCandidates.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import { logDataIntegritySkips } from "./dataIntegrity.ts";
import { querySmartFolderWorks } from "./smartFolderWorks.ts";
import { WorkRepo } from "./workRepo.ts";

const scanLogger = getCategoryLogger("scan");
const KEY_TAG_PREFIXES_SEEDED = "tag_prefixes_seeded";

export function initializeTagPrefixes(repo: WorkRepo): void {
  if (repo.getUserSetting(KEY_TAG_PREFIXES_SEEDED) === null) {
    for (const def of DEFAULT_TAG_PREFIXES) repo.createTagPrefix(def);
    repo.setUserSetting(KEY_TAG_PREFIXES_SEEDED, "1");
  }
}

export function createClassificationMethods(deps: { repo: WorkRepo }) {
  const { repo } = deps;
  return {
    async getAxisFacets(axis: string, filter?: AxisFacetsFilter): Promise<AxisFacetItem[]> {
      return repo.getAxisFacets(axis, filter);
    },

    async listTagPrefixes(): Promise<TagPrefix[]> {
      return repo.listTagPrefixes();
    },
    async createTagPrefix(input: TagPrefixCreate): Promise<TagPrefix | null> {
      return repo.createTagPrefix(input);
    },
    async updateTagPrefix(prefix: string, patch: TagPrefixUpdate): Promise<TagPrefix | null> {
      return repo.updateTagPrefix(prefix, patch);
    },
    async deleteTagPrefix(prefix: string): Promise<boolean> {
      return repo.deleteTagPrefix(prefix);
    },
    async listTagPrefixCandidates(): Promise<TagPrefixCandidate[]> {
      const { summaries, skipped } = repo.listSummaries();
      logDataIntegritySkips(scanLogger, "tag-prefix-candidates", skipped);
      return buildTagPrefixCandidates(
        summaries,
        repo.listTagPrefixes().map((p) => p.prefix),
      );
    },

    async listSmartFolders(): Promise<SmartFolder[]> {
      return repo.listSmartFolders();
    },
    async createSmartFolder(input: SmartFolderCreate): Promise<SmartFolder> {
      return repo.createSmartFolder(input);
    },
    async updateSmartFolder(id: string, input: SmartFolderUpdate): Promise<SmartFolder | null> {
      return repo.updateSmartFolder(id, input);
    },
    async deleteSmartFolder(id: string): Promise<boolean> {
      return repo.deleteSmartFolder(id);
    },
    async evalSmartFolder(id: string, query: SmartFolderEvalQuery): Promise<WorksPage | null> {
      const folder = repo.getSmartFolder(id);
      if (!folder) return null;
      return querySmartFolderWorks(repo, folder, query);
    },
  };
}
