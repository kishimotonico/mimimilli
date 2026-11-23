import { smartFolderViolation } from "@mimimilli/shared";
import type {
  SmartFolderPatch,
  TagPrefix,
  TagPrefixCandidate,
  TagPrefixCreate,
  TagPrefixUpdate,
} from "@mimimilli/shared";
import type {
  ClassificationAdapter,
  SmartFolderInsert,
  SmartFolderRow,
  SmartFolderUpdateResult,
} from "../../adapter/classification.ts";
import { buildTagPrefixCandidates } from "../../core/tagPrefixCandidates.ts";
import { composeWorks, type FixtureState } from "./state.ts";

export function createClassificationMethods(state: FixtureState): ClassificationAdapter {
  return {
    async listTagPrefixes(): Promise<TagPrefix[]> {
      return [...state.tagPrefixes].sort((a, b) => a.order - b.order);
    },

    async createTagPrefix(input: TagPrefixCreate): Promise<TagPrefix | null> {
      if (state.tagPrefixes.some((p) => p.prefix === input.prefix)) return null;
      const nextOrder = state.tagPrefixes.reduce((max, p) => Math.max(max, p.order + 1), 0);
      const created: TagPrefix = { ...input, order: nextOrder };
      state.tagPrefixes.push(created);
      return created;
    },

    async updateTagPrefix(prefix: string, patch: TagPrefixUpdate): Promise<TagPrefix | null> {
      const def = state.tagPrefixes.find((p) => p.prefix === prefix);
      if (!def) return null;
      if (patch.label !== undefined) def.label = patch.label;
      if (patch.color !== undefined) def.color = patch.color;
      if (patch.protected !== undefined) def.protected = patch.protected;
      return def;
    },

    async reorderTagPrefixes(order: string[]): Promise<TagPrefix[] | null> {
      const existing = new Set(state.tagPrefixes.map((p) => p.prefix));
      if (order.length !== existing.size || new Set(order).size !== order.length) return null;
      if (!order.every((prefix) => existing.has(prefix))) return null;
      const orderIndex = new Map(order.map((prefix, index) => [prefix, index]));
      for (const def of state.tagPrefixes) def.order = orderIndex.get(def.prefix)!;
      return [...state.tagPrefixes].sort((a, b) => a.order - b.order);
    },

    async deleteTagPrefix(prefix: string): Promise<boolean> {
      const before = state.tagPrefixes.length;
      state.tagPrefixes = state.tagPrefixes.filter((p) => p.prefix !== prefix);
      return state.tagPrefixes.length < before;
    },

    async listTagPrefixCandidates(): Promise<TagPrefixCandidate[]> {
      return buildTagPrefixCandidates(
        composeWorks(state),
        state.tagPrefixes.map((p) => p.prefix),
      );
    },

    async listSmartFolders(): Promise<SmartFolderRow[]> {
      return [...state.smartFolders].sort((a, b) => a.position - b.position);
    },

    async getSmartFolder(id: string): Promise<SmartFolderRow | null> {
      return state.smartFolders.find((f) => f.id === id) ?? null;
    },

    async insertSmartFolder(
      folder: SmartFolderInsert,
      position?: number,
    ): Promise<SmartFolderRow | null> {
      if (state.smartFolders.some((f) => f.id === folder.id)) return null;
      const at =
        position ?? state.smartFolders.reduce((max, f) => Math.max(max, f.position + 1), 0);
      if (state.smartFolders.some((f) => f.position === at)) {
        for (const f of state.smartFolders) if (f.position >= at) f.position += 1;
      }
      const created = { ...folder, position: at };
      state.smartFolders.push(created);
      return created;
    },

    async updateSmartFolder(
      id: string,
      patch: SmartFolderPatch,
    ): Promise<SmartFolderUpdateResult | null> {
      const folder = state.smartFolders.find((f) => f.id === id);
      if (!folder) return null;
      const violation = smartFolderViolation({ ...folder, ...patch });
      if (violation) return { violation };
      Object.assign(folder, patch);
      return { row: folder };
    },

    async reorderSmartFolders(ids: string[]): Promise<SmartFolderRow[] | null> {
      const existing = new Set(state.smartFolders.map((f) => f.id));
      if (ids.length !== existing.size || !ids.every((id) => existing.has(id))) return null;
      ids.forEach((id, position) => {
        state.smartFolders.find((f) => f.id === id)!.position = position;
      });
      return [...state.smartFolders].sort((a, b) => a.position - b.position);
    },

    async deleteSmartFolder(id: string): Promise<boolean> {
      const before = state.smartFolders.length;
      state.smartFolders = state.smartFolders.filter((f) => f.id !== id);
      return state.smartFolders.length < before;
    },
  };
}
