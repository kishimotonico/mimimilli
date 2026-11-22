// スマートフォルダーの変更の唯一の口（作成・更新・削除と取り消し・並べ替え・既定の並びの保存）。
// 失敗はサーバーの文言のままトーストで見せ、一覧を取り直す（404/409 のような食い違いも含む）。
// 成功のあとの無効化もここ1か所で決める。

import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom, useStore } from "jotai";
import {
  ALL_SMART_FOLDER_ID,
  isBrokenSmartFolder,
  isReadableSmartFolder,
  type ReadableSmartFolder,
  type SmartFolder,
  type SmartFolderWrite,
  type SortId,
} from "@mimimilli/shared";
import { libraryRouteAtom } from "../../../entities/library/model/navigationAtoms";
import { replaceLibraryFolderAtom } from "../../../entities/library/model/navigationActions";
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
  /** 定義（名前・条件・グループ分け・既定の並び）を保存する。保存できたら true */
  update: (id: string, data: SmartFolderWrite, failureMessage?: string) => Promise<boolean>;
  /** 既定の並びだけを変える。定義の結果は変わらないので、作品・値の一覧は取り直さない */
  saveDefaultSort: (folder: ReadableSmartFolder, sort: SortId) => Promise<boolean>;
  /** 削除して「元に戻す」を出す。開いている（保持しているものも含む）なら「すべて」へ置き換えで移る */
  remove: (folder: SmartFolder) => Promise<void>;
}

/** 変更が一覧のどこへ効くか。none は応答でキャッシュを直接更新したとき */
type Refresh = "none" | "folders" | "definition";

export function useSmartFolderEditor(): SmartFolderEditor {
  const queryClient = useQueryClient();
  const toast = useToast();
  const store = useStore();
  const replaceFolder = useSetAtom(replaceLibraryFolderAtom);

  return useMemo<SmartFolderEditor>(() => {
    const refreshFolders = () =>
      queryClient.invalidateQueries({ queryKey: SMART_FOLDER_QUERY_KEYS.all() });

    // 定義が変わったスマートフォルダーの作品・値も取り直す。一覧が更新されてから行う
    const refresh = async (scope: Refresh) => {
      if (scope === "none") return;
      await refreshFolders();
      if (scope === "definition") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: SMART_FOLDER_QUERY_KEYS.allWorks() }),
          queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.allGroupValues() }),
        ]);
      }
    };

    /** 変更の唯一の実行路。成功なら onSuccess のあとに refresh、失敗ならトーストと一覧の取り直し */
    const commit = async <T>(
      failure: string,
      scope: Refresh,
      request: () => Promise<T>,
      onSuccess?: (result: T) => void,
    ): Promise<T | null> => {
      let result: T;
      try {
        result = await request();
      } catch (error) {
        toast.error(apiErrorMessage(error, failure));
        await refreshFolders();
        return null;
      }
      onSuccess?.(result);
      await refresh(scope);
      return result;
    };

    const restore = async (folder: SmartFolder) => {
      if (!isReadableSmartFolder(folder)) return;
      await commit("元に戻せませんでした", "folders", () =>
        restoreSmartFolder({
          id: folder.id,
          name: folder.name,
          condition: folder.condition,
          sort: folder.sort,
          groupBy: folder.groupBy,
          position: folder.position,
          createdAt: folder.createdAt,
        }),
      );
    };

    const showDeleted = (folder: SmartFolder) => {
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
    };

    return {
      reorder: async (ids) => {
        const key = SMART_FOLDER_QUERY_KEYS.all();
        const before = queryClient.getQueryData<SmartFolder[]>(key);
        await queryClient.cancelQueries({ queryKey: key });
        if (before) queryClient.setQueryData(key, applyOrder(before, ids));
        await commit(
          "並び順を保存できませんでした",
          "none",
          () => reorderSmartFolders(ids),
          (rows) => queryClient.setQueryData(key, rows),
        );
      },
      create: (data) =>
        commit("スマートフォルダーを作れませんでした", "folders", () => createSmartFolder(data)),
      addFromTemplate: (templateId) =>
        commit("既定のスマートフォルダーを追加できませんでした", "folders", () =>
          createSmartFolderFromTemplate(templateId),
        ),
      update: async (id, data, failureMessage = "スマートフォルダーを保存できませんでした") =>
        (await commit(failureMessage, "definition", () => updateSmartFolder(id, data))) !== null,
      saveDefaultSort: async (folder, sort) =>
        (await commit("並びを既定にできませんでした", "folders", () =>
          updateSmartFolder(folder.id, {
            name: folder.name,
            condition: folder.condition,
            sort,
            groupBy: folder.groupBy,
          }),
        )) !== null,
      remove: async (folder) => {
        await commit(
          "スマートフォルダーを削除できませんでした",
          "folders",
          () => deleteSmartFolder(folder.id),
          () => {
            if (store.get(libraryRouteAtom).folderId === folder.id) {
              replaceFolder(ALL_SMART_FOLDER_ID);
            }
            showDeleted(folder);
          },
        );
      },
    };
  }, [queryClient, toast, store, replaceFolder]);
}
