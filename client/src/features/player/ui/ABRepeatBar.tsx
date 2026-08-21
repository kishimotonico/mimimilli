import { formatTime } from "../../../shared/lib/format";
import { cn } from "../../../shared/lib/cn";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import type { PlayerState } from "../model/usePlayerState";

interface ABRepeatBarProps {
  abRepeat: PlayerState["abRepeat"];
  onSetABPoint: (point: "a" | "b") => void;
  onClearABRepeat: () => void;
}

export default function ABRepeatBar({ abRepeat, onSetABPoint, onClearABRepeat }: ABRepeatBarProps) {
  // リピートが実際に成立する条件（usePlayer 側のループ発動条件と同じ a < b）
  const hasABRepeat = abRepeat.a !== null && abRepeat.b !== null && abRepeat.a < abRepeat.b;

  return (
    <div className="flex items-center gap-2 whitespace-nowrap pt-2.5">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3">
        A-Bリピート
      </span>
      <button
        type="button"
        aria-label="A地点を設定"
        title="A地点を設定"
        onClick={() => onSetABPoint("a")}
        className={cn(
          "grid h-[26px] w-[26px] cursor-pointer place-items-center rounded-2 font-mono text-[11px] font-bold",
          abRepeat.a !== null ? "bg-acc-soft text-acc" : "text-ink-1 hover:bg-paper-2",
        )}
      >
        A
      </button>
      <button
        type="button"
        aria-label="B地点を設定"
        title="B地点を設定"
        onClick={() => onSetABPoint("b")}
        className={cn(
          "grid h-[26px] w-[26px] cursor-pointer place-items-center rounded-2 font-mono text-[11px] font-bold",
          abRepeat.b !== null ? "bg-acc-soft text-acc" : "text-ink-1 hover:bg-paper-2",
        )}
      >
        B
      </button>
      {(abRepeat.a !== null || abRepeat.b !== null) && (
        <>
          <span className="font-mono text-[10.5px] text-ink-3">
            {abRepeat.a !== null ? formatTime(abRepeat.a) : "--:--"}
            {" – "}
            {abRepeat.b !== null ? formatTime(abRepeat.b) : "--:--"}
          </span>
          <IconButton size="sm" icon={I.x} label="A-Bリピートを解除" onClick={onClearABRepeat} />
        </>
      )}
      {hasABRepeat && (
        <span className="font-mono text-[10.5px] text-acc" aria-live="polite">
          リピート中
        </span>
      )}
    </div>
  );
}
