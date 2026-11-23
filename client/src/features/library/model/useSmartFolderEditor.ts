// スマートフォルダーの変更の唯一の口（作成・更新・削除と取り消し・並べ替え）。
// 画面の動きは成功応答を受けた同期区間で、キャッシュへ反映する前に済ませる。
// 失敗はトーストで見せ（検証エラーはサーバーの文言、not_found・conflict は行の名前と動詞）、一覧を取り直す（404/409 のような食い違いも含む）。
// 成功のあとの無効化もここ1か所で決める。

import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom, useStore } from "jotai";
import {
  definitionOf,
  findSmartFolderTemplate,
  type SmartFolder,
  type SmartFolderPatch,
  type SmartFolderWrite,
} from "@mimimilli/shared";
import {
  dropLibraryGroupAtom,
  settleLibraryFolderAtom,
} from "../../../entities/library/model/navigationActions";
import { appRouteAtom } from "../../../entities/navigation/model/appRouteStore";
import {
  createSmartFolder,
  deleteSmartFolder,
  reorderSmartFolders,
  updateSmartFolder,
} from "../../../entities/smart-folder/api";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { ApiRequestError } from "../../../shared/api/http";
import { apiErrorMessage } from "../../../shared/lib/apiError";
import { useToast } from "../../../shared/ui/useToast";
import { groupByKey } from "../../../entities/smart-folder/groupByKey";
import { isGroupedWorksKey } from "./folderWorksRequest";
import { applyOrder } from "./smartFolderEditing";

export interface SmartFolderEditor {
  /** 全件の順序を送る。先に画面へ反映し、失敗したら戻す。呼び出し側が保存中の重なりを防ぐ */
  reorder: (ids: string[]) => Promise<void>;
  /** 作った行。成功したら、保存を始めたときから画面が動いていなければそこへ入る（履歴を積む）。失敗は null */
  create: (data: SmartFolderWrite) => Promise<SmartFolder | null>;
  /** 既定から追加する。作ったあとの動きは create と同じ */
  addFromTemplate: (templateId: string) => Promise<SmartFolder | null>;
  /** 送った列だけを更新する（定義の保存・検索の上書きとその取り消し・既定の並びの保存）。保存できたら true。
   *  reenter（検索の上書き）は成功したら、保存を始めたときから画面が動いていなければ同じ行へ置き換えで入り直す */
  patch: (
    id: string,
    change: SmartFolderPatch,
    options?: { failureMessage?: string; reenter?: boolean },
  ) => Promise<boolean>;
  /** 削除して「元に戻す」を出す。開いている行の退避は route の補正が行う */
  remove: (folder: SmartFolder) => Promise<void>;
}

/** 変更が一覧のどこへ効くか。none は応答でキャッシュを直接更新したとき。
 *  definitionOf は定義の結果が変わったフォルダーで、そのフォルダーの作品・値の一覧も取り直す */
type Refresh = "none" | "folders" | { definitionOf: string };

export function useSmartFolderEditor(): SmartFolderEditor {
  const queryClient = useQueryClient();
  const toast = useToast();
  const store = useStore();
  const settle = useSetAtom(settleLibraryFolderAtom);
  const dropGroup = useSetAtom(dropLibraryGroupAtom);

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

    /** 作成・追加・定義の更新の成功応答の行を、一覧の再取得を待たず ID 単位で反映する。順序は続く再取得で取り直す */
    const upsertFolder = (row: SmartFolder) =>
      queryClient.setQueryData<SmartFolder[]>(SMART_FOLDER_QUERY_KEYS.all(), (prev) => {
        if (prev === undefined) return prev;
        return prev.some((folder) => folder.id === row.id)
          ? prev.map((folder) => (folder.id === row.id ? row : folder))
          : [...prev, row];
      });

    const dropFolder = (id: string) =>
      queryClient.setQueryData<SmartFolder[]>(SMART_FOLDER_QUERY_KEYS.all(), (prev) =>
        prev?.filter((folder) => folder.id !== id),
      );

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
        // 404・409 の文言は ID を含み、何を操作したかが伝わらない。それ以外（検証エラー・再設定中など）はサーバーの文言を出す
        const conflicted =
          error instanceof ApiRequestError &&
          (error.code === "not_found" || error.code === "conflict");
        toast.error(conflicted ? failure : apiErrorMessage(error, failure));
        await refreshFolders();
        return null;
      }
      onSuccess?.(result);
      await refresh(scope);
      return result;
    };

    const restore = async (folder: SmartFolder) => {
      await commit("元に戻せませんでした", "folders", () =>
        createSmartFolder({ ...definitionOf(folder), id: folder.id, position: folder.position }),
      );
    };

    const showDeleted = (folder: SmartFolder) => {
      let undone = false;
      toast.show({
        message: `「${folder.name}」を削除しました`,
        variant: "success",
        actionLabel: "元に戻す",
        onAction: () => {
          if (undone) return;
          undone = true;
          toast.dismiss();
          void restore(folder);
        },
        priority: "action",
        dismissOnUnmount: false,
      });
    };

    const createAndEnter = (
      failure: string,
      request: () => Promise<SmartFolder>,
    ): Promise<SmartFolder | null> => {
      const started = store.get(appRouteAtom);
      return commit(failure, "folders", request, (row) => {
        settle(started, row.id);
        upsertFolder(row);
      });
    };

    return {
      reorder: async (ids) => {
        const key = SMART_FOLDER_QUERY_KEYS.all();
        await queryClient.cancelQueries({ queryKey: key, exact: true });
        const before = queryClient.getQueryData<SmartFolder[]>(key);
        if (before) queryClient.setQueryData(key, applyOrder(before, ids));
        await commit(
          "並び順を保存できませんでした",
          "none",
          () => reorderSmartFolders(ids),
          (rows) => queryClient.setQueryData(key, rows),
        );
      },
      create: (data) =>
        createAndEnter(`「${data.name}」を作れませんでした`, () => createSmartFolder(data)),
      addFromTemplate: (templateId) => {
        const template = findSmartFolderTemplate(templateId)!;
        return createAndEnter(`「${template.name}」を追加できませんでした`, () =>
          createSmartFolder({ ...definitionOf(template), id: template.id }),
        );
      },
      patch: async (id, change, { failureMessage, reenter = false } = {}) => {
        const started = store.get(appRouteAtom);
        const scope: Refresh =
          "condition" in change || "groupBy" in change ? { definitionOf: id } : "folders";
        const name = queryClient
          .getQueryData<SmartFolder[]>(SMART_FOLDER_QUERY_KEYS.all())
          ?.find((folder) => folder.id === id)?.name;
        const saved = await commit(
          failureMessage ??
            (name === undefined ? "保存できませんでした" : `「${name}」を保存できませんでした`),
          scope,
          () => updateSmartFolder(id, change),
          (row) => {
            const before = queryClient
              .getQueryData<SmartFolder[]>(SMART_FOLDER_QUERY_KEYS.all())
              ?.find((folder) => folder.id === id);
            if (reenter) settle(started, id, true);
            if (before !== undefined && groupByKey(before.groupBy) !== groupByKey(row.groupBy)) {
              dropGroup(id);
              // 古いグループ分けの値を指す作品一覧は、取り直さず捨てる（新しいグループ分けでは 400 になる）
              queryClient.removeQueries({
                queryKey: SMART_FOLDER_QUERY_KEYS.folderWorks(id),
                predicate: (query) => isGroupedWorksKey(query.queryKey),
              });
            }
            upsertFolder(row);
          },
        );
        return saved !== null;
      },
      remove: async (folder) => {
        await commit(
          `「${folder.name}」を削除できませんでした`,
          "folders",
          () => deleteSmartFolder(folder.id),
          () => {
            dropFolder(folder.id);
            showDeleted(folder);
          },
        );
      },
    };
  }, [queryClient, store, toast, settle, dropGroup]);
}
