import {
  DEFAULT_TAG_PREFIXES,
  SMART_FOLDER_TEMPLATES,
  type SmartFolderWrite,
  type SortId,
  type TagPrefix,
  type TagPrefixCandidate,
  type TagPrefixCreate,
  type TagPrefixUpdate,
} from "@mimimilli/shared";
import type { SmartFolderInsert, SmartFolderRow } from "../../adapter/classification.ts";
import { insertFromTemplate } from "../../core/smartFolderPolicy.ts";
import { buildTagPrefixCandidates } from "../../core/tagPrefixCandidates.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import { logDataIntegritySkips } from "./dataIntegrity.ts";
import type { UserWorkStateRepository } from "./userWorkStateRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";

const scanLogger = getCategoryLogger("scan");
const KEY_TAG_PREFIXES_SEEDED = "tag_prefixes_seeded";
const KEY_SMART_FOLDERS_SEEDED = "smart_folders_seeded";

export function initializeTagPrefixes(user: UserWorkStateRepository): void {
  if (user.getUserSetting(KEY_TAG_PREFIXES_SEEDED) === null) {
    for (const def of DEFAULT_TAG_PREFIXES) user.createTagPrefix(def);
    user.setUserSetting(KEY_TAG_PREFIXES_SEEDED, "1");
  }
}

/** 「すべて」は migration が入れる。残りの既定は初回だけ入れ、全部消しても戻さない */
export function initializeSmartFolders(user: UserWorkStateRepository): void {
  if (user.getUserSetting(KEY_SMART_FOLDERS_SEEDED) !== null) return;
  const createdAt = new Date().toISOString();
  user.seedSmartFolders(
    SMART_FOLDER_TEMPLATES.filter((template) => template.seeded).map((template) =>
      insertFromTemplate(template, createdAt),
    ),
    KEY_SMART_FOLDERS_SEEDED,
  );
}

export function createClassificationMethods(deps: {
  query: WorkQueryRepository;
  user: UserWorkStateRepository;
}) {
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

    async listSmartFolders(): Promise<SmartFolderRow[]> {
      return user.listSmartFolders();
    },
    async getSmartFolder(id: string): Promise<SmartFolderRow | null> {
      return user.getSmartFolder(id);
    },
    async appendSmartFolder(folder: SmartFolderInsert): Promise<SmartFolderRow | null> {
      return user.appendSmartFolder(folder);
    },
    async restoreSmartFolder(
      folder: SmartFolderInsert & { position: number },
    ): Promise<SmartFolderRow | null> {
      return user.restoreSmartFolder(folder);
    },
    async updateSmartFolder(id: string, input: SmartFolderWrite): Promise<SmartFolderRow | null> {
      return user.updateSmartFolder(id, input);
    },
    async updateSmartFolderSort(id: string, sort: SortId | null): Promise<SmartFolderRow | null> {
      return user.updateSmartFolderSort(id, sort);
    },
    async reorderSmartFolders(ids: string[]): Promise<SmartFolderRow[] | null> {
      return user.reorderSmartFolders(ids);
    },
    async deleteSmartFolder(id: string): Promise<boolean> {
      return user.deleteSmartFolder(id);
    },
  };
}
