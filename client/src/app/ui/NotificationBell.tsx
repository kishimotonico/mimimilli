// ライブラリの健康状態（RJコード未検出・DLsite取得失敗・DLsite未連携・直近のスキャン結果）を
// 集約する通知ベルパネル（TASK-44）。開閉・外側クリック/Escapeでの閉じ方は
// AddressBar の並び替えメニュー（.mle-sortmenu）と同じ「position:relative + absolute」の
// 素朴な実装に倣う（work-preview専用の useAnchoredPopover は左寄せクランプ前提でここには合わない）。
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DlsiteNotificationModalKind } from "../model/activeModal";
import { dlsiteBulkActiveAtom, dlsiteBulkProgressAtom } from "../../features/dlsite/model/atoms";
import { useDlsiteBulkActions } from "../../features/dlsite/model/useDlsiteBulkActions";
import { useDlsiteNotificationSummary } from "../../features/library/model/useDlsiteNotificationSummary";
import { getLastScanResult, SCAN_QUERY_KEYS } from "../../features/scan/api";
import Button from "../../shared/ui/Button";
import { I } from "../../shared/ui/Icon";
import IconButton from "../../shared/ui/IconButton";

export interface NotificationBellProps {
  /** 直近のスキャン結果クリックでスキャンモーダルの結果表示を開く（TASK-56） */
  onOpenScanResult: () => void;
  onOpenNotificationModal: (kind: DlsiteNotificationModalKind) => void;
}

export default function NotificationBell({
  onOpenScanResult,
  onOpenNotificationModal,
}: NotificationBellProps) {
  const dlsiteBulkActive = useAtomValue(dlsiteBulkActiveAtom);
  const dlsiteBulkProgress = useAtomValue(dlsiteBulkProgressAtom);
  const { start: onStartDlsiteBulk } = useDlsiteBulkActions();
  // 前回スキャン結果（ディスク永続化なし、TASK-56）。App から降ろした購読（TASK-124）。
  const lastScanQuery = useQuery({
    queryKey: SCAN_QUERY_KEYS.last(),
    queryFn: getLastScanResult,
  });
  const scanResult = lastScanQuery.data?.result ?? null;
  const {
    rjCodeMissingCount,
    fetchFailedCount: dlsiteFetchFailedCount,
    parseErrorAlert: dlsiteParseErrorAlert,
    parseErrorCount: dlsiteParseErrorCount,
    unlinkedCount: dlsiteUnlinkedCount,
  } = useDlsiteNotificationSummary();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const badgeCount =
    rjCodeMissingCount +
    dlsiteFetchFailedCount +
    (dlsiteParseErrorAlert ? dlsiteParseErrorCount : 0);
  const showUnlinkedRow = dlsiteUnlinkedCount > 0 || dlsiteBulkActive;
  const isEmpty =
    rjCodeMissingCount === 0 &&
    dlsiteFetchFailedCount === 0 &&
    !dlsiteParseErrorAlert &&
    !showUnlinkedRow &&
    !scanResult;

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <IconButton
        size="md"
        icon={I.bell}
        label={badgeCount > 0 ? `通知（要対応${badgeCount}件）` : "通知"}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        active={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      />
      {badgeCount > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-0 flex h-[15px] min-w-[15px] items-center justify-center rounded-pill px-[3px] font-mono text-[9px] font-bold text-paper-1"
          style={{ background: "var(--r-coral)" }}
        >
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
      {isOpen && (
        <div
          role="menu"
          aria-label="通知"
          className="absolute top-[calc(100%+8px)] right-0 z-30 w-[340px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[10px] border border-line-soft bg-paper-1 shadow-pop"
        >
          {isEmpty ? (
            <p className="px-3.5 py-4 text-center text-[11.5px] text-ink-3">
              対応が必要な通知はありません
            </p>
          ) : (
            <div className="flex flex-col [&>*+*]:border-t [&>*+*]:border-line-soft">
              {rjCodeMissingCount > 0 && (
                <NotifRow
                  label="RJコード未検出"
                  count={rjCodeMissingCount}
                  onClick={() => {
                    setIsOpen(false);
                    onOpenNotificationModal("rj-missing");
                  }}
                />
              )}
              {dlsiteParseErrorAlert && (
                <NotifRow
                  label="DLsiteパース失敗"
                  count={dlsiteParseErrorCount}
                  accent="mustard"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenNotificationModal("parse-failed");
                  }}
                />
              )}
              {dlsiteFetchFailedCount > 0 && (
                <NotifRow
                  label="DLsite取得失敗"
                  count={dlsiteFetchFailedCount}
                  onClick={() => {
                    setIsOpen(false);
                    onOpenNotificationModal("fetch-failed");
                  }}
                />
              )}
              {showUnlinkedRow && (
                <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[12px] text-ink-0">DLsite未連携</p>
                    <p className="font-mono text-[10.5px] text-ink-3" aria-live="polite">
                      {dlsiteBulkActive
                        ? dlsiteBulkProgress
                          ? `取得中 (${dlsiteBulkProgress.processed}/${dlsiteBulkProgress.total})`
                          : "取得中..."
                        : `${dlsiteUnlinkedCount}件`}
                    </p>
                  </div>
                  <Button variant="primary" disabled={dlsiteBulkActive} onClick={onStartDlsiteBulk}>
                    まとめて取得
                  </Button>
                </div>
              )}
              {scanResult && (
                <button
                  type="button"
                  className="block w-full px-3.5 py-2.5 text-left hover:bg-paper-2 focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-acc"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenScanResult();
                  }}
                >
                  <p className="mb-1.5 font-sans text-[11px] font-medium text-ink-1">
                    直近のスキャン結果
                  </p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10.5px]">
                    <ScanStat label="登録済み" value={scanResult.registered} />
                    <ScanStat label="新規" value={scanResult.newlyGenerated} />
                    <ScanStat label="エラー" value={scanResult.errors} />
                    <ScanStat label="行方不明" value={scanResult.missing} />
                  </dl>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotifRow({
  label,
  count,
  onClick,
  accent = "coral",
}: {
  label: string;
  count: number;
  onClick: () => void;
  accent?: "coral" | "mustard";
}) {
  const iconColor = accent === "mustard" ? "var(--r-mustard)" : "var(--r-coral)";
  return (
    <button
      type="button"
      role="menuitem"
      className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-paper-2 focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-acc"
      onClick={onClick}
    >
      <span className="flex items-center gap-1.5 text-[12px] text-ink-0">
        <I.err size={13} style={{ color: iconColor }} />
        {label}
      </span>
      <span className="flex items-center gap-1 font-mono text-[11px] text-ink-2">
        {count}件
        <I.chev size={12} className="text-ink-3" />
      </span>
    </button>
  );
}

function ScanStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-ink-1">{value}</dd>
    </div>
  );
}
