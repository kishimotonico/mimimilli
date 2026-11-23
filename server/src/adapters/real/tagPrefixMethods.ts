import {
  DEFAULT_TAG_PREFIXES,
  type TagPrefix,
  type TagPrefixCandidate,
  type TagPrefixCreate,
  type TagPrefixUpdate,
} from "@mimimilli/shared";
import type { TagPrefixAdapter } from "../../adapter/tagPrefix.ts";
import { buildTagPrefixCandidates } from "../../core/tagPrefixCandidates.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import { logDataIntegritySkips } from "./dataIntegrity.ts";
import type { UserWorkStateRepository } from "./userWorkStateRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";

const scanLogger = getCategoryLogger("scan");
const KEY_TAG_PREFIXES_SEEDED = "tag_prefixes_seeded";

export function initializeTagPrefixes(user: UserWorkStateRepository): void {
  if (user.getUserSetting(KEY_TAG_PREFIXES_SEEDED) === null) {
    for (const def of DEFAULT_TAG_PREFIXES) user.createTagPrefix(def);
    user.setUserSetting(KEY_TAG_PREFIXES_SEEDED, "1");
  }
}

export function createTagPrefixMethods(deps: {
  query: WorkQueryRepository;
  user: UserWorkStateRepository;
}): TagPrefixAdapter {
  const { query, user } = deps;
  return {
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
  };
}
