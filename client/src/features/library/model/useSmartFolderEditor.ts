// スマートフォルダーの編集の操作（並べ替え・作成・更新・削除と取り消し）。
// 失敗はサーバーの文言のままトーストで見せる。

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isBrokenSmartFolder, type SmartFolder, type SmartFolderWrite } from "@mimimilli/shared";
import {
  createSmartFolder,
  createSmartFolderFromTemplate,
  deleteSmartFolder,
  reorderSmartFolders,
  restoreSmartFolder,
  updateSmartFolder,
} from "../../../entities/smart-folder/api";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { apiErrorMessage } from "../../../shared/lib/apiError";
import { useToast } from "../../../shared/ui/useToast";
import { applyOrder } from "./smartFolderEditing";

export interface SmartFolderEditor {
  /** 全件の順序を送る。先に画面へ反映し、失敗したら戻す */
  reorder: (ids: string[]) => Promise<void>;
  /** 作ったスマートフォルダー。失敗は null */
  create: (data: SmartFolderWrite) => Promise<SmartFolder | null>;
  addFromTemplate: (templateId: string) => Promise<SmartFolder | null>;
  update: (id: string, data: SmartFolderWrite) => Promise<boolean>;
  /** onDeleted は削除が成功した直後（一覧を取り直す前）に呼ぶ */
  remove: (folder: SmartFolder, onDeleted?: () => void) => Promise<void>;
}

export function useSmartFolderEditor(): SmartFolderEditor {
  const queryClient = useQueryClient();
  const toast = useToast();

  const refreshFolders = useCallback(
    () => queryClient.invalidateQueries({ queryKey: SMART_FOLDER_QUERY_KEYS.all() }),
    [queryClient],
  );

  // 定義が変わったスマートフォルダーの作品・値は取り直す。一覧が更新されてから行う
  const refreshAfterUpdate = useCallback(async () => {
    await refreshFolders();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: SMART_FOLDER_QUERY_KEYS.allWorks() }),
      queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.allFacets() }),
    ]);
  }, [queryClient, refreshFolders]);

  return useMemo<SmartFolderEditor>(() => {
    const attempt = async <T>(fallback: string, run: () => Promise<T>): Promise<T | null> => {
      try {
        return await run();
      } catch (error) {
        toast.error(apiErrorMessage(error, fallback));
        return null;
      }
    };

    const restore = async (folder: SmartFolder) => {
      const { condition } = folder;
      if (condition === null) return;
      const restored = await attempt("元に戻せませんでした", () =>
        restoreSmartFolder({
          id: folder.id,
          name: folder.name,
          condition,
          sort: folder.sort,
          groupBy: folder.groupBy,
          position: folder.position,
          createdAt: folder.createdAt,
        }),
      );
      if (restored) await refreshFolders();
    };

    return {
      reorder: async (ids) => {
        const key = SMART_FOLDER_QUERY_KEYS.all();
        const before = queryClient.getQueryData<SmartFolder[]>(key);
        await queryClient.cancelQueries({ queryKey: key });
        if (before) queryClient.setQueryData(key, applyOrder(before, ids));
        const rows = await attempt("並び順を保存できませんでした", () => reorderSmartFolders(ids));
        if (rows) queryClient.setQueryData(key, rows);
        else await queryClient.invalidateQueries({ queryKey: key });
      },
      create: async (data) => {
        const created = await attempt("スマートフォルダーを作れませんでした", () =>
          createSmartFolder(data),
        );
        if (created) await refreshFolders();
        return created;
      },
      addFromTemplate: async (templateId) => {
        const created = await attempt("既定のスマートフォルダーを追加できませんでした", () =>
          createSmartFolderFromTemplate(templateId),
        );
        if (created) await refreshFolders();
        return created;
      },
      update: async (id, data) => {
        const updated = await attempt("スマートフォルダーを保存できませんでした", () =>
          updateSmartFolder(id, data),
        );
        if (updated) await refreshAfterUpdate();
        return updated !== null;
      },
      remove: async (folder, onDeleted) => {
        const done = await attempt("スマートフォルダーを削除できませんでした", async () => {
          await deleteSmartFolder(folder.id);
          return true;
        });
        if (!done) return;
        onDeleted?.();
        // 壊れた行は戻せる形（condition）が無いので「元に戻す」を出さない
        let undone = false;
        toast.show({
          message: `「${folder.name}」を削除しました`,
          variant: "success",
          ...(isBrokenSmartFolder(folder)
            ? {}
            : {
                actionLabel: "元に戻す",
                onAction: () => {
                  if (undone) return;
                  undone = true;
                  toast.dismiss();
                  void restore(folder);
                },
              }),
          priority: "action",
          dismissOnUnmount: false,
        });
        await refreshFolders();
      },
    };
  }, [queryClient, toast, refreshFolders, refreshAfterUpdate]);
}
