import type {
  TagPrefix,
  TagPrefixCandidate,
  TagPrefixCreate,
  TagPrefixUpdate,
} from "@mimimilli/shared";
import type { TagPrefixAdapter } from "../../adapter/tagPrefix.ts";
import { buildTagPrefixCandidates } from "../../core/tagPrefixCandidates.ts";
import { composeWorks, type FixtureState } from "./state.ts";

export function createTagPrefixMethods(state: FixtureState): TagPrefixAdapter {
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
  };
}
