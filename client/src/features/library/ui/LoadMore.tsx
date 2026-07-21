import Button from "../../../shared/ui/Button";

interface LoadMoreProps {
  /** 現在までに読み込み済みの件数 */
  loadedCount: number;
  /** サーバー側の総件数（未取得なら undefined） */
  totalCount?: number;
  isFetching: boolean;
  onLoadMore: () => void;
}

/** 作品一覧の末尾に置く追加読み込みボタン（TASK-73） */
export default function LoadMore({
  loadedCount,
  totalCount,
  isFetching,
  onLoadMore,
}: LoadMoreProps) {
  const remaining = totalCount !== undefined ? Math.max(0, totalCount - loadedCount) : null;
  return (
    <div className="mll-loadmore">
      <Button variant="ghost" onClick={onLoadMore} disabled={isFetching}>
        {isFetching
          ? "読み込み中..."
          : remaining !== null
            ? `さらに読み込む（残り ${remaining} 件）`
            : "さらに読み込む"}
      </Button>
    </div>
  );
}
