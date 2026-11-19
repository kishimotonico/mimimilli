// ライブラリの健康状態（RJコード未検出・DLsite取得失敗・直近のスキャン結果）を
// 集約する通知ベルパネル。開閉・外側クリック/Escapeでの閉じ方は
// AddressBar の並び替えメニュー（.mle-sortmenu）と同じ「position:relative + absolute」の
// 素朴な実装に倣う（work-preview専用の useAnchoredPopover は左寄せクランプ前提でここには合わない）。
import { useSetAtom } from "jotai";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { activeModalAtom } from "../../shared/model/activeModalAtom";
import { useDlsiteNotificationSummary } from "../../entities/dlsite/model/useDlsiteNotificationSummary";
import {
  scanDiagnosticsQueryOptions,
  scanRecordQueryOptions,
} from "../../entities/scan/queryOptions";
import {
  buildNeedsAttentionRows,
  countNeedsAttention,
} from "../../features/scan/model/needsAttention";
import { I } from "../../shared/ui/Icon";
import IconButton from "../../shared/ui/IconButton";
import { usePopoverDismissal } from "../../shared/ui/usePopoverDismissal";

export default function NotificationBell() {
  const setActiveModal = useSetAtom(activeModalAtom);
  // 直近のスキャンの記録（サーバーのメモリ）。購読する。
  const scanRecordQuery = useQuery(scanRecordQueryOptions);
  const scanRecord = scanRecordQuery.data?.finishedAt ? scanRecordQuery.data : null;
  // 診断はスキャン時点のスナップショットではなく常に最新を見る（要対応タブと同じクエリ）。
  const diagnosticsQuery = useQuery(scanDiagnosticsQueryOptions);
  const {
    rjCodeMissingCount,
    fetchFailedCount: dlsiteFetchFailedCount,
    parseErrorAlert: dlsiteParseErrorAlert,
    parseErrorCount: dlsiteParseErrorCount,
  } = useDlsiteNotificationSummary();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  usePopoverDismissal({
    isOpen,
    onClose: () => setIsOpen(false),
    anchorRef: rootRef,
  });

  // 要対応タブと同じ定義・同じ件数を使う。
  const scanAttentionCount = countNeedsAttention(
    buildNeedsAttentionRows({
      diagnostics: diagnosticsQuery.data,
      record: scanRecord ?? undefined,
    }),
  );
  const dlsiteRows: DlsiteRow[] = [
    { label: "RJコード未検出", count: rjCodeMissingCount, modal: "rj-missing", accent: "coral" },
    {
      label: "DLsite取得失敗",
      count: dlsiteFetchFailedCount,
      modal: "fetch-failed",
      accent: "coral",
    },
    {
      label: "DLsiteパース失敗",
      count: dlsiteParseErrorAlert ? dlsiteParseErrorCount : 0,
      modal: "parse-failed",
      accent: "mustard",
    },
  ].filter((row) => row.count > 0) as DlsiteRow[];
  const badgeCount = scanAttentionCount + dlsiteRows.reduce((total, row) => total + row.count, 0);
  const isEmpty = badgeCount === 0 && !scanRecord;

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
          className="pointer-events-none absolute top-0 right-0 flex h-[15px] min-w-[15px] items-center justify-center rounded-pill px-[3px] font-mono text-badge font-bold text-paper-1"
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
            <p className="px-3.5 py-4 text-center text-caption text-ink-2">
              対応が必要な通知はありません
            </p>
          ) : (
            <div className="flex flex-col [&>*+*]:border-t [&>*+*]:border-line-soft">
              {scanAttentionCount > 0 && (
                <NotifRow
                  label="要対応"
                  count={scanAttentionCount}
                  onClick={() => {
                    setIsOpen(false);
                    setActiveModal({ kind: "scan", tab: "needsAttention" });
                  }}
                />
              )}
              {dlsiteRows.map((row) => (
                <NotifRow
                  key={row.modal}
                  label={row.label}
                  count={row.count}
                  accent={row.accent}
                  onClick={() => {
                    setIsOpen(false);
                    setActiveModal({ kind: row.modal });
                  }}
                />
              ))}
              {scanRecord && (
                <button
                  type="button"
                  className="block w-full px-3.5 py-2.5 text-left hover:bg-paper-2 focus-visible:-outline-offset-2"
                  onClick={() => {
                    setIsOpen(false);
                    setActiveModal({ kind: "scan" });
                  }}
                >
                  <p className="mb-1.5 font-sans text-secondary font-medium text-ink-1">
                    直近のスキャン結果
                  </p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-mono">
                    <ScanStat label="更新済み" value={scanRecord.updatedWorks.length} />
                    <ScanStat label="行方不明" value={scanRecord.missingWorks.length} />
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

interface DlsiteRow {
  label: string;
  count: number;
  modal: "rj-missing" | "fetch-failed" | "parse-failed";
  accent: "coral" | "mustard";
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
      className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-paper-2 focus-visible:-outline-offset-2"
      onClick={onClick}
    >
      <span className="flex items-center gap-1.5 text-body text-ink-0">
        <I.err size={13} style={{ color: iconColor }} />
        {label}
      </span>
      <span className="flex items-center gap-1 font-mono text-mono text-ink-2">
        {count}件
        <I.chev size={12} className="text-ink-3" />
      </span>
    </button>
  );
}

function ScanStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-ink-2">{label}</dt>
      <dd className="text-ink-1">{value}</dd>
    </div>
  );
}
