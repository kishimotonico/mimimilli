import type {
  AxisFacetItem,
  AxisFacetsQuery,
  SmartFolder,
  SmartFolderCreate,
  SmartFolderEvalQuery,
  SmartFolderRule,
  SmartFolderUpdate,
  TagPrefix,
  TagPrefixCandidate,
  TagPrefixCreate,
  TagPrefixUpdate,
  WorksPage,
} from "@mimimilli/shared";
import type { ClassificationAdapter } from "../../adapter/classification.ts";
import { buildAxisFacets } from "../../core/axisFacets.ts";
import { buildTagPrefixCandidates } from "../../core/tagPrefixCandidates.ts";
import { evalSmartFolder, evalSmartFolderRules } from "../../core/smartFolder.ts";
import { toWorksPage } from "../../core/worksQuery.ts";
import { composeWorks, type FixtureState } from "./state.ts";

export function createClassificationMethods(state: FixtureState): ClassificationAdapter {
  return {
    async getAxisFacets(
      axis: string,
      filter?: Partial<AxisFacetsQuery>,
    ): Promise<AxisFacetItem[] | null> {
      if (filter?.smartFolder) {
        const folder = state.smartFolders.find((f) => f.id === filter.smartFolder);
        // /smart-folders/:id/works と同じ「解決できない」応答（404）に揃える
        if (!folder) return null;
        const matched = evalSmartFolderRules(folder.rules, composeWorks(state));
        return buildAxisFacets(axis, matched, filter);
      }
      return buildAxisFacets(axis, composeWorks(state), filter);
    },

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
      if (patch.showAsAxis !== undefined) def.showAsAxis = patch.showAsAxis;
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

    async listSmartFolders(): Promise<SmartFolder[]> {
      return state.smartFolders;
    },

    async createSmartFolder(input: SmartFolderCreate): Promise<SmartFolder> {
      const smartFolder: SmartFolder = {
        id: `sf-${state.nextSmartFolderId++}`,
        name: input.name,
        rules: input.rules,
        sort: input.sort,
        createdAt: new Date().toISOString(),
      };
      state.smartFolders.push(smartFolder);
      return smartFolder;
    },

    async updateSmartFolder(id: string, input: SmartFolderUpdate): Promise<SmartFolder | null> {
      const folder = state.smartFolders.find((f) => f.id === id);
      if (!folder) return null;
      if (input.name !== undefined) folder.name = input.name;
      if (input.rules !== undefined) folder.rules = input.rules;
      if (input.sort !== undefined) folder.sort = input.sort;
      return folder;
    },

    async deleteSmartFolder(id: string): Promise<boolean> {
      const before = state.smartFolders.length;
      state.smartFolders = state.smartFolders.filter((f) => f.id !== id);
      return state.smartFolders.length < before;
    },

    async evalSmartFolder(id: string, query: SmartFolderEvalQuery): Promise<WorksPage | null> {
      const folder = state.smartFolders.find((f) => f.id === id);
      if (!folder) return null;
      const page = toWorksPage(
        evalSmartFolder(folder, composeWorks(state), query),
        state.rootFolder ?? "/library",
      );
      return state.dataIntegrityWarning
        ? { ...page, dataIntegrityWarning: state.dataIntegrityWarning }
        : page;
    },

    async previewSmartFolderRuleCount(rules: SmartFolderRule[]): Promise<number> {
      return evalSmartFolderRules(rules, composeWorks(state)).length;
    },
  };
}
