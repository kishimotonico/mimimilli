// スマートフォルダーの変更の唯一の口（作成・更新・削除と取り消し・並べ替え・既定の並びの保存）。
// 失敗はサーバーの文言のままトーストで見せ、一覧を取り直す（404/409 のような食い違いも含む）。
// 成功のあとの無効化もここ1か所で決める。

import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import {
  ALL_SMART_FOLDER_ID,
  isBrokenSmartFolder,
  isReadableSmartFolder,
  type SmartFolder,
  type GroupSortId,
  type SmartFolderWrite,
  type SortId,
} from "@mimimilli/shared";
import { replaceLibraryFolderAtom } from "../../../entities/library/model/navigationActions";
import {
  createSmartFolder,
  createSmartFolderFromTemplate,
  deleteSmartFolder,
  reorderSmartFolders,
  restoreSmartFolder,
  updateSmartFolder,
  updateSmartFolderGroupSort,
  updateSmartFolderSort,
} from "../../../entities/smart-folder/api";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { apiErrorMessage } from "../../../shared/lib/apiError";
import { useToast } from "../../../shared/ui/useToast";
import { groupByKey } from "../../../entities/smart-folder/groupByKey";
import { applyOrder } from "./smartFolderEditing";

export interface SmartFolderEditor {
  /** 全件の順序を送る。先に画面へ反映し、失敗したら戻す。保存は1本ずつ直列で、待つ間は最新の順だけを持つ */
  reorder: (ids: string[]) => Promise<void>;
  /** 作ったスマートフォルダー。失敗は null */
  create: (data: SmartFolderWrite) => Promise<SmartFolder | null>;
  addFromTemplate: (templateId: string) => Promise<SmartFolder | null>;
  /** 定義（名前・条件・グループ分け・既定の並び）を保存する。保存できたら true */
  update: (id: string, data: SmartFolderWrite, failureMessage?: string) => Promise<boolean>;
  /** 既定の並びだけを変える。定義の結果は変わらないので、作品・値の一覧は取り直さない */
  saveDefaultSort: (id: string, sort: SortId) => Promise<boolean>;
  /** 値一覧の既定の並びだけを変える。作品・値の一覧は取り直さない（並びは要求に含まれる） */
  saveDefaultGroupSort: (id: string, groupSort: GroupSortId) => Promise<boolean>;
  /** 削除して「元に戻す」を出す。開いている（保持しているものも含む）なら「すべて」へ置き換えで移る */
  remove: (folder: SmartFolder) => Promise<void>;
}

/** 並べ替えの保存の待ち行列。フックの再マウントをまたいで直列を保つため、モジュールで持つ */
const reorderQueue: { running: boolean; waiting: string[] | null } = {
  running: false,
  waiting: null,
};

/** 変更が一覧のどこへ効くか。none は応答でキャッシュを直接更新したとき。
 *  definitionOf は定義が変わったフォルダーで、そのフォルダーの作品・値の一覧も取り直す */
type Refresh = "none" | "folders" | { definitionOf: string };

export function useSmartFolderEditor(): SmartFolderEditor {
  const queryClient = useQueryClient();
  const toast = useToast();
  const replaceFolder = useSetAtom(replaceLibraryFolderAtom);

  return useMemo<SmartFolderEditor>(() => {
    const refreshFolders = () =>
      queryClient.invalidateQueries({ queryKey: SMART_FOLDER_QUERY_KEYS.all() });

    // 定義が変わったスマートフォルダーの作品・値も取り直す。一覧が更新されてから行う
    const refresh = async (scope: Refresh) => {
      if (scope === "none") return;
      await refreshFolders();
      if (scope !== "folders") {
        const id = scope.definitionOf;
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: SMART_FOLDER_QUERY_KEYS.folderWorks(id) }),
          queryClient.invalidateQueries({ queryKey: SMART_FOLDER_QUERY_KEYS.folderGroups(id) }),
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
          groupSort: folder.groupSort,
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
        await queryClient.cancelQueries({ queryKey: key });
        const before = queryClient.getQueryData<SmartFolder[]>(key);
        if (before) queryClient.setQueryData(key, applyOrder(before, ids));
        if (reorderQueue.running) {
          reorderQueue.waiting = ids;
          return;
        }
        reorderQueue.running = true;
        try {
          let next: string[] | null = ids;
          while (next) {
            const sending: string[] = next;
            reorderQueue.waiting = null;
            await commit(
              "並び順を保存できませんでした",
              "none",
              () => reorderSmartFolders(sending),
              (rows) => {
                if (reorderQueue.waiting === null) queryClient.setQueryData(key, rows);
              },
            );
            next = reorderQueue.waiting;
          }
        } finally {
          reorderQueue.running = false;
        }
      },
      create: (data) =>
        commit("スマートフォルダーを作れませんでした", "folders", () => createSmartFolder(data)),
      addFromTemplate: (templateId) =>
        commit("既定のスマートフォルダーを追加できませんでした", "folders", () =>
          createSmartFolderFromTemplate(templateId),
        ),
      update: async (id, data, failureMessage = "スマートフォルダーを保存できませんでした") => {
        const before = queryClient
          .getQueryData<SmartFolder[]>(SMART_FOLDER_QUERY_KEYS.all())
          ?.find((folder) => folder.id === id);
        const saved = await commit(failureMessage, { definitionOf: id }, () =>
          updateSmartFolder(id, data),
        );
        // 開いている一覧の ?group= は古いグループ分けの値なので、一覧が更新されたあとに入り直して外す
        if (
          saved &&
          before !== undefined &&
          groupByKey(before.groupBy) !== groupByKey(saved.groupBy)
        ) {
          replaceFolder(id, id);
        }
        return saved !== null;
      },
      saveDefaultSort: async (id, sort) =>
        (await commit("並びを既定にできませんでした", "folders", () =>
          updateSmartFolderSort(id, sort),
        )) !== null,
      saveDefaultGroupSort: async (id, groupSort) =>
        (await commit("値の並びを既定にできませんでした", "folders", () =>
          updateSmartFolderGroupSort(id, groupSort),
        )) !== null,
      remove: async (folder) => {
        await commit(
          "スマートフォルダーを削除できませんでした",
          "folders",
          () => deleteSmartFolder(folder.id),
          () => {
            replaceFolder(folder.id, ALL_SMART_FOLDER_ID);
            showDeleted(folder);
          },
        );
      },
    };
  }, [queryClient, toast, replaceFolder]);
}
