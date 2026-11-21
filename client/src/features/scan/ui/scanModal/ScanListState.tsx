import type { ReactNode } from "react";
import CollectionStatus from "../../../../shared/ui/CollectionStatus";
import { NOT_SCANNED_MESSAGE } from "../../model/scanListStatus";
import type { DisplayedScanListStatus } from "./useDisplayedScanListStatus";

interface ScanListStateProps {
  /** useDisplayedScanListStatus の返り値 */
  status: DisplayedScanListStatus;
  emptyMessage: string;
  onRetry: () => void;
  /** ready の一覧の ARIA table */
  table: { label: string; rowCount?: number };
  /** 一覧の上に出す固定の帯。スケルトンと ready のときだけ、同じ位置に出す */
  heading?: ReactNode;
  children: ReactNode;
}

/** 4タブ共通の一覧状態。表示用の status に従って描くだけ。 */
export default function ScanListState({
  status,
  emptyMessage,
  onRetry,
  table,
  heading,
  children,
}: ScanListStateProps) {
  switch (status) {
    case "pending":
      return null;
    case "loading":
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          {heading}
          <div className="flex min-h-0 flex-1 flex-col">
            <CollectionStatus variant="list" kind="loading" />
          </div>
        </div>
      );
    case "ready":
      return (
        <div
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 仮想リストは行を絶対配置するため table 要素にできず、ready の一覧に role で ARIA table 構造を与える
          role="table"
          aria-label={table.label}
          aria-rowcount={table.rowCount}
          className="flex min-h-0 flex-1 flex-col"
        >
          {heading}
          {children}
        </div>
      );
    case "error":
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          <CollectionStatus variant="list" kind="error" onRetry={onRetry} />
        </div>
      );
    case "notScanned":
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          <CollectionStatus variant="list" kind="empty" message={NOT_SCANNED_MESSAGE} />
        </div>
      );
    case "empty":
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          <CollectionStatus variant="list" kind="empty" message={emptyMessage} />
        </div>
      );
  }
}
