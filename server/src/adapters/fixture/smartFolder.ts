import { smartFolderViolation, type SmartFolder, type SmartFolderPatch } from "@mimimilli/shared";
import type {
  SmartFolderAdapter,
  SmartFolderInsert,
  SmartFolderUpdateResult,
} from "../../adapter/smartFolder.ts";
import type { FixtureState } from "./state.ts";

export function createSmartFolderMethods(state: FixtureState): SmartFolderAdapter {
  return {
    async listSmartFolders(): Promise<SmartFolder[]> {
      return [...state.smartFolders].sort((a, b) => a.position - b.position);
    },

    async getSmartFolder(id: string): Promise<SmartFolder | null> {
      return state.smartFolders.find((f) => f.id === id) ?? null;
    },

    async insertSmartFolder(
      folder: SmartFolderInsert,
      position?: number,
    ): Promise<SmartFolder | null> {
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

    async reorderSmartFolders(ids: string[]): Promise<SmartFolder[] | null> {
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
