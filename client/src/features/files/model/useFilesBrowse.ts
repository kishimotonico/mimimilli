// useFilesNavigation（位置）の上に、実際に見えるもの（一覧データ・プレビュー対象・エラー）を
// 導出する層。FilesView と FilePreview が同じものを読み、ナビゲーション + 一覧取得の二重管理を防ぐ。
// cwdQueryは queryKey が同一（FILE_SYSTEM_QUERY_KEYS.directory(cwd)）なのでキャッシュを共有し、
// 複数箇所から呼んでも追加リクエストは発生しない。

import { useQuery } from "@tanstack/react-query";
import { browseFs } from "../api";
import { useFilesNavigation, type FilesNav } from "./useFilesNavigation";
import { FILE_SYSTEM_QUERY_KEYS } from "../../../entities/file-system/queryKeys";
import { ApiRequestError } from "../../../shared/api/http";
import { isFilesSelectionMissing, rootLabel, type FileLoadError, type FsEntry } from "./types";
import { workspacePath } from "@mimimilli/shared";

export interface FilesBrowse {
  nav: FilesNav;
  /** カレントディレクトリ直下のエントリ */
  entries: FsEntry[];
  isPending: boolean;
  isError: boolean;
  /** 404（対象フォルダーが存在しない）。再試行しても直らないため isError と表示を分ける */
  notFound: boolean;
  loadError: FileLoadError | null;
  /** 選択中エントリ、なければカレントディレクトリ自身（loadError中はnull） */
  previewEntry: FsEntry | null;
  /** previewEntryがdirのときその直下エントリ */
  folderEntries: FsEntry[] | null;
  /** 再生キューの材料。previewEntryがdirならその直下エントリ、fileならカレントディレクトリの
   *  一覧（同じフォルダー内の他の音声を次トラックとして繋ぐ） */
  playbackSourceEntries: FsEntry[];
  /** ディレクトリ取得は成功したが選択中パスがその中に無いとき、そのパス */
  missingSelectionPath: string | null;
  hasAncestors: boolean;
  refetchCwd: () => void;
}

export function useFilesBrowse(root: string): FilesBrowse {
  const nav = useFilesNavigation(root);

  const cwdQuery = useQuery({
    queryKey: FILE_SYSTEM_QUERY_KEYS.directory(nav.cwd),
    queryFn: () => browseFs(nav.cwd),
  });
  const entries = cwdQuery.data?.entries ?? [];
  const cwdNotFound = cwdQuery.error instanceof ApiRequestError && cwdQuery.error.status === 404;
  const loadError: FileLoadError | null = !cwdQuery.isError
    ? null
    : cwdNotFound
      ? "notFound"
      : "error";

  const cwdTitle = nav.relPath.slice(-1)[0] ?? rootLabel(root);

  // ── プレビュー対象 ────────────────────────────────────────
  // ファイル選択中はそのファイル、それ以外はカレント dir 自身。
  // cwd取得に失敗している間は、実在確認できていないエントリを合成表示しない。
  const cwdFolderEntry: FsEntry | null = loadError
    ? null
    : {
        name: cwdTitle,
        path: workspacePath(nav.relPath.join("/")),
        isDir: true,
        size: 0,
        fileType: "dir",
        childCount: entries.length,
        workId: cwdQuery.data?.workId ?? null,
        workRelPath: null,
        mediaKind: null,
        preview: null,
      };
  const hasSelection = !loadError && nav.selectedPath != null && nav.selectedPath !== nav.cwd;
  const fileSelection = hasSelection
    ? (entries.find((e) => e.path === nav.selectedPath) ?? null)
    : null;
  // ディレクトリ自体は正常に取得できたが、選択中パスがその中に存在しない
  // （ライブラリのエラー詳細・スキャン要対応の「Filesで開く」で移動・削除済みの対象を
  // 指すことがある）。この場合もフォルダーへ黙って差し替えず、対象なしを表示する
  // （openPathInFilesAtom経由での到達を含む）。
  const selectionMissing = isFilesSelectionMissing({
    hasLoadError: !!loadError,
    isPending: cwdQuery.isPending,
    selectedPath: nav.selectedPath,
    cwd: nav.cwd,
    entries,
  });
  const previewEntry = selectionMissing ? null : (fileSelection ?? cwdFolderEntry);
  const folderEntries = previewEntry?.isDir ? entries : null;
  const playbackSourceEntries = folderEntries ?? entries;

  const hasAncestors = nav.relPath.length >= 1;

  return {
    nav,
    entries,
    isPending: cwdQuery.isPending,
    isError: cwdQuery.isError,
    notFound: cwdNotFound,
    loadError,
    previewEntry,
    folderEntries,
    playbackSourceEntries,
    missingSelectionPath: selectionMissing ? nav.selectedPath : null,
    hasAncestors,
    refetchCwd: () => {
      cwdQuery.refetch();
    },
  };
}
