import type {
  AxisFacetItem,
  AxisFacetsQuery,
  SmartFolder,
  SmartFolderCreate,
  SmartFolderEvalQuery,
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
import { evalSmartFolder } from "../../core/smartFolder.ts";
import { toWorksPage } from "../../core/worksQuery.ts";
import type { FixtureState } from "./state.ts";

export function createClassificationMethods(state: FixtureState): ClassificationAdapter {
  return {
    async getAxisFacets(axis: string, filter?: Partial<AxisFacetsQuery>): Promise<AxisFacetItem[]> {
      return buildAxisFacets(axis, state.works, filter);
    },

    async listTagPrefixes(): Promise<TagPrefix[]> {
      return state.tagPrefixes;
    },

    async createTagPrefix(input: TagPrefixCreate): Promise<TagPrefix | null> {
      if (state.tagPrefixes.some((p) => p.prefix === input.prefix)) return null;
      const created: TagPrefix = { ...input };
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

    async deleteTagPrefix(prefix: string): Promise<boolean> {
      const before = state.tagPrefixes.length;
      state.tagPrefixes = state.tagPrefixes.filter((p) => p.prefix !== prefix);
      return state.tagPrefixes.length < before;
    },

    async listTagPrefixCandidates(): Promise<TagPrefixCandidate[]> {
      return buildTagPrefixCandidates(
        state.works,
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
      return toWorksPage(
        evalSmartFolder(folder, state.works, query),
        state.rootFolder ?? "/library",
      );
    },
  };
}
