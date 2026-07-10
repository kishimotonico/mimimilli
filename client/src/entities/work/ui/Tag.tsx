import { parseTag } from "../model";
import { cn } from "../../../shared/lib/cn";
import { I } from "../../../shared/ui/Icon";

interface TagProps {
  tag: string;
  onRemove?: () => void;
  onClick?: () => void;
  /** 削除リクエスト送信中。専用のスピナーに差し替え、クリック不可にする */
  pending?: boolean;
  /** 直前の削除が失敗した。目立たせて onRemove をリトライ導線として使う */
  failed?: boolean;
}

const CAT_LABELS: Record<string, string> = {
  cv: "CV",
  サークル: "CIR",
  シリーズ: "SR",
  カテゴリ: "CAT",
  category: "CAT",
  genre: "GNR",
};

const CAT_CLASSES: Record<string, string> = {
  cv: "text-cv",
  サークル: "text-circle",
  シリーズ: "text-series",
  カテゴリ: "text-cat",
  category: "text-cat",
  genre: "text-cat",
};

const TAG_BASE =
  "group inline-flex h-5 items-center gap-[3px] whitespace-nowrap rounded-1 bg-paper-2 px-[7px] font-jp text-[10.5px] text-ink-1 hover:bg-paper-3";

// 通常時は薄く、hover/focus時だけ強調する（誤操作の的にならないようにする）。
const REMOVE_BUTTON =
  "cursor-pointer bg-transparent p-0 text-[13px] leading-none text-ink-4 opacity-40 transition-opacity duration-150 group-hover:opacity-100 group-hover:text-ink-0 focus-visible:opacity-100 focus-visible:text-ink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-acc focus-visible:outline-offset-1";

function RemoveSlot({
  value,
  onRemove,
  pending,
  failed,
}: {
  value: string;
  onRemove?: () => void;
  pending?: boolean;
  failed?: boolean;
}) {
  if (pending) {
    return (
      <span className="inline-flex h-[13px] w-[13px] items-center justify-center" aria-hidden>
        <I.refresh
          size={10}
          className="motion-safe:animate-spin motion-reduce:animate-none text-ink-3"
        />
      </span>
    );
  }
  if (!onRemove) return null;
  return (
    <button
      type="button"
      className={cn(REMOVE_BUTTON, failed && "opacity-100 text-[color:var(--r-coral)]")}
      aria-label={
        failed
          ? `タグ「${value}」の削除に失敗しました。クリックして再試行`
          : `タグ「${value}」を削除`
      }
      title={failed ? "削除に失敗しました。クリックして再試行" : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
    >
      {failed ? <I.refresh size={10} /> : "×"}
    </button>
  );
}

export default function Tag({ tag, onRemove, onClick, pending, failed }: TagProps) {
  const parsed = parseTag(tag);
  const tagClass = cn(
    TAG_BASE,
    onClick && "cursor-pointer",
    failed && "ring-1 ring-[color:var(--r-coral)]",
  );

  if (parsed.kind === "flat") {
    const content = (
      <>
        {parsed.value}
        <RemoveSlot value={parsed.value} onRemove={onRemove} pending={pending} failed={failed} />
      </>
    );

    if (onClick && !onRemove) {
      return (
        <button type="button" className={tagClass} onClick={onClick}>
          {content}
        </button>
      );
    }

    return <span className={tagClass}>{content}</span>;
  }

  const catLabel = CAT_LABELS[parsed.prefix] ?? parsed.prefix.toUpperCase().slice(0, 4);
  const catClass = CAT_CLASSES[parsed.prefix] ?? "text-cat";

  const content = (
    <>
      <span className="font-mono text-[9.5px] uppercase text-ink-3">{catLabel}</span>
      <span className={cn("font-medium", catClass)}>{parsed.value}</span>
      <RemoveSlot value={parsed.value} onRemove={onRemove} pending={pending} failed={failed} />
    </>
  );

  if (onClick && !onRemove) {
    return (
      <button type="button" className={tagClass} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <span className={tagClass}>{content}</span>;
}
