import {
  DEFAULT_TAG_PREFIXES,
  type AxisFacetItem,
  type SmartFolder,
  type SmartFolderCreate,
  type SmartFolderRule,
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
import {
  countSmartFolderRuleMatches,
  getSmartFolderAxisFacets,
  querySmartFolderWorks,
} from "./smartFolderWorks.ts";

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
  requireRoot: () => string;
}) {
  const { query, user, requireRoot } = deps;
  return {
    async getAxisFacets(axis: string, filter?: Partial<AxisFacetsQuery>): Promise<AxisFacetItem[]> {
      if (filter?.smartFolder) {
        const folder = user.getSmartFolder(filter.smartFolder);
        // 表示中に削除される等で解決できない場合は、通常軸と同じ形（空配列）で返す。
        // 個々の値の有無を判定するファセット集計にとって404化は過剰であり、
        // 呼び出し側（結果面）は既にフォルダー解決不可を別経路で検知している。
        if (!folder) return [];
        return getSmartFolderAxisFacets(query, axis, folder, filter);
      }
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
    async reorderTagPrefixes(order: string[]): Promise<TagPrefix[] | null> {
      return user.reorderTagPrefixes(order);
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
      return querySmartFolderWorks(query, folder, evalQuery, requireRoot());
    },
    async previewSmartFolderRuleCount(rules: SmartFolderRule[]): Promise<number> {
      return countSmartFolderRuleMatches(query, rules);
    },
  };
}
