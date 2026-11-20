import type { ReactNode } from "react";
import CollectionStatus from "../../../../shared/ui/CollectionStatus";
import { NOT_SCANNED_MESSAGE, type ScanListStatus } from "../../model/scanListStatus";

interface ScanListStateProps {
  status: ScanListStatus;
  emptyMessage: string;
  onRetry: () => void;
  children: ReactNode;
}

/** 4タブ共通の一覧状態。ready のときだけ中身を出す。 */
export default function ScanListState({
  status,
  emptyMessage,
  onRetry,
  children,
}: ScanListStateProps) {
  if (status === "ready") return <>{children}</>;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {status === "loading" && <CollectionStatus variant="list" kind="loading" />}
      {status === "error" && <CollectionStatus variant="list" kind="error" onRetry={onRetry} />}
      {status === "notScanned" && (
        <CollectionStatus variant="list" kind="empty" message={NOT_SCANNED_MESSAGE} />
      )}
      {status === "empty" && (
        <CollectionStatus variant="list" kind="empty" message={emptyMessage} />
      )}
    </div>
  );
}
