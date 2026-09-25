import type { WorkListItem } from "@mimimilli/shared";
import type { LibraryViewActions, LibraryViewState } from "../model/useLibraryNavigation";

/** 次ページ読み込み関連 */
export interface WorkResultsPagination {
  hasNextPage?: boolean;
  worksTotal?: number;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}

/** 0件時の空状態表示に必要な情報 */
export interface WorkResultsEmptyState {
  searchQuery: string;
  isSmartFolder?: boolean;
  onClearSearch: () => void;
  onEditSmartFolderRules?: () => void;
}

/** WorkGrid・WorkListPane共通のprops。表示形式（grid/list）だけが異なり、
 *  受け取る情報は同じであるため型を1つに揃える。 */
export interface WorkResultsProps {
  nav: LibraryViewState & LibraryViewActions;
  works: WorkListItem[];
  /** 検索・軸・ソート・タグ変更を検知してスクロール位置をリセットする key */
  worksQueryKey: string;
  /** 遷移中は直前の一覧を薄く表示する。 */
  isPending?: boolean;
  /** 画面下張り付きの再生バーが表示中か（末尾余白の確保に使う） */
  dockedBarActive?: boolean;
  onWorkPlay: (work: WorkListItem) => void;
  pagination: WorkResultsPagination;
  emptyState: WorkResultsEmptyState;
}
