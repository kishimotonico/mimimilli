import type { ReactNode } from "react";
import { formatDlsiteFetchEstimate } from "../../../../../entities/dlsite/model/dlsiteFetchFrame";
import { useDlsiteFetchFrame } from "../../../../../entities/dlsite/useDlsiteJob";
import Button from "../../../../../shared/ui/Button";

interface DlsiteFetchProgressProps {
  onCancel: () => void;
  /** 進捗がないときに枠の右端（主ボタンの側）へ寄せて出すもの */
  idleHint?: ReactNode;
}

/** フッターの主ボタンの位置に出る、取得の進捗と中止。幅を常に確保し、出入りで周りがずれない。 */
export default function DlsiteFetchProgress({ onCancel, idleHint }: DlsiteFetchProgressProps) {
  const frame = useDlsiteFetchFrame();
  return (
    <div className="flex h-[30px] w-[300px] shrink-0 items-center justify-end gap-3">
      {frame.kind !== "progress" && idleHint}
      {frame.kind === "progress" && (
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
      )}
    </div>
  );
}
