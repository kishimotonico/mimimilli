import { DLSITE_FETCH_ESTIMATE_MS_PER_CODE } from "@mimimilli/shared";
import { formatDlsiteFetchEstimate } from "../../../../../entities/dlsite/model/dlsiteBulkFrame";
import { useDlsiteBulkFrame } from "../../../../../entities/dlsite/useDlsiteJob";
import Button from "../../../../../shared/ui/Button";

interface DlsiteFetchSlotProps {
  targetCount: number;
  busy: boolean;
  onStart: () => void;
  onCancel: () => void;
}

/** 高さ・幅固定の枠。取得ボタンと、まとめての取得の進捗を同じ場所で入れ替える。 */
export default function DlsiteFetchSlot({
  targetCount,
  busy,
  onStart,
  onCancel,
}: DlsiteFetchSlotProps) {
  const frame = useDlsiteBulkFrame();
  return (
    <div className="flex h-[30px] w-[340px] shrink-0 items-center justify-end gap-3">
      {frame.kind === "progress" ? (
        <>
          <div className="flex min-w-0 flex-col items-end gap-1">
            <span className="font-jp text-secondary text-ink-1">
              取得中 <span className="font-mono">{frame.processed}</span> /{" "}
              <span className="font-mono">{frame.total}</span>
              <span className="ml-2 text-ink-2">
                残り{formatDlsiteFetchEstimate(frame.remainingMs)}
              </span>
            </span>
            <span
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- <progress> は細いバーの見た目を固定しにくく、2色のバーを自前で描くため role=progressbar を使う
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={frame.total}
              aria-valuenow={frame.processed}
              aria-label="DLsite取得の進捗"
              className="block h-[3px] w-[180px] overflow-hidden rounded-full bg-paper-3"
            >
              <span
                className="block h-full bg-acc"
                style={{
                  width: `${frame.total === 0 ? 0 : Math.min(100, (frame.processed / frame.total) * 100)}%`,
                }}
              />
            </span>
          </div>
          <Button variant="danger-quiet" disabled={!frame.cancellable} onClick={onCancel}>
            中止
          </Button>
        </>
      ) : (
        <>
          {targetCount > 0 && (
            <span className="font-jp text-caption text-ink-2">
              {targetCount}件・
              {formatDlsiteFetchEstimate(targetCount * DLSITE_FETCH_ESTIMATE_MS_PER_CODE)}
            </span>
          )}
          <Button variant="ghost" disabled={busy || targetCount === 0} onClick={onStart}>
            DLsiteから取得
          </Button>
        </>
      )}
    </div>
  );
}
