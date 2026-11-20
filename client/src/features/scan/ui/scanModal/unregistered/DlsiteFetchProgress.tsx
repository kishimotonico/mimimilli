import { useDlsiteFetchFrame } from "../../../../../entities/dlsite/useDlsiteJob";
import Button from "../../../../../shared/ui/Button";

interface DlsiteFetchProgressProps {
  onCancel: () => void;
}

/** フッターの主ボタンの位置に出る、取得の進捗と中止。幅を常に確保し、出入りで周りがずれない。 */
export default function DlsiteFetchProgress({ onCancel }: DlsiteFetchProgressProps) {
  const frame = useDlsiteFetchFrame();
  return (
    <div className="flex h-[30px] w-[300px] shrink-0 items-center justify-end gap-2.5">
      {frame.kind === "progress" && (
        <>
          <span className="whitespace-nowrap font-jp text-body text-ink-1">
            取得中 <span className="font-mono">{frame.processed}</span>/
            <span className="font-mono">{frame.total}</span>
          </span>
          <span
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- <progress> は細いバーの見た目を固定しにくく、2色のバーを自前で描くため role=progressbar を使う
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={frame.total}
            aria-valuenow={frame.processed}
            aria-label="DLsite取得の進捗"
            className="block h-1 w-[110px] shrink-0 overflow-hidden rounded-full bg-paper-3"
          >
            <span
              className="block h-full bg-acc"
              style={{
                width: `${frame.total === 0 ? 0 : Math.min(100, (frame.processed / frame.total) * 100)}%`,
              }}
            />
          </span>
          <Button variant="danger-quiet" disabled={!frame.cancellable} onClick={onCancel}>
            中止
          </Button>
        </>
      )}
    </div>
  );
}
