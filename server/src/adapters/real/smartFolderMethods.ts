import type { SmartFolder, SmartFolderPatch } from "@mimimilli/shared";
import type {
  SmartFolderAdapter,
  SmartFolderInsert,
  SmartFolderUpdateResult,
} from "../../adapter/smartFolder.ts";
import { initialSmartFolders } from "../../core/smartFolderInitialRows.ts";
import type { UserWorkStateRepository } from "./userWorkStateRepository.ts";

const KEY_SMART_FOLDERS_SEEDED = "smart_folders_seeded";

export function initializeSmartFolders(user: UserWorkStateRepository): void {
  const seeded = user.getUserSetting(KEY_SMART_FOLDERS_SEEDED) !== null;
  const rows = initialSmartFolders(
    new Set(user.smartFolderIds()),
    seeded,
    new Date().toISOString(),
  );
  if (rows.length === 0 && seeded) return;
  user.seedSmartFolders(rows, KEY_SMART_FOLDERS_SEEDED);
}

export function createSmartFolderMethods(deps: {
  user: UserWorkStateRepository;
}): SmartFolderAdapter {
  const { user } = deps;
  return {
    async listSmartFolders(): Promise<SmartFolder[]> {
      return user.listSmartFolders();
    },
    async getSmartFolder(id: string): Promise<SmartFolder | null> {
      return user.getSmartFolder(id);
    },
    async insertSmartFolder(
      folder: SmartFolderInsert,
      position?: number,
    ): Promise<SmartFolder | null> {
      return user.insertSmartFolder(folder, position);
    },
    async updateSmartFolder(
      id: string,
      patch: SmartFolderPatch,
    ): Promise<SmartFolderUpdateResult | null> {
      return user.updateSmartFolder(id, patch);
    },
    async reorderSmartFolders(ids: string[]): Promise<SmartFolder[] | null> {
      return user.reorderSmartFolders(ids);
    },
    async deleteSmartFolder(id: string): Promise<boolean> {
      return user.deleteSmartFolder(id);
    },
  };
}
