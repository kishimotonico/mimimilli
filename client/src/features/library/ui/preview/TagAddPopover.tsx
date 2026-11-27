import { useRef, useState } from "react";
import { normalizeTag } from "@mimimilli/shared";
import { I } from "../../../../shared/ui/Icon";
import IconButton from "../../../../shared/ui/IconButton";
import TagCombobox from "../../../../shared/ui/TagCombobox";
import { cn } from "../../../../shared/lib/cn";
import { layerPanelClass } from "../../../../shared/ui/layer/layerStyles";
import { useDismissOnOutsidePress } from "../../../../shared/ui/layer/useDismissOnOutsidePress";
import {
  MotionPopoverRoot,
  MotionPopoverTrigger,
  PopoverPopup,
  useMotionPopover,
} from "../../../../shared/ui/popover/MotionPopover";

type OpenMode = "inline" | "popover";

interface TagAddPopoverProps {
  suggestions: string[];
  excludeTags: string[];
  /** 無効。フォーカスを残したまま開けなくし、開いていれば閉じる */
  disabled?: boolean;
  /** 位置決めの境界 */
  boundary?: HTMLElement | null;
  /** 狭い幅では、ポップオーバーではなく親の行の下へ展開する（開く時点の値で決まる） */
  inlineWhenNarrow?: boolean;
  /** 開く操作の直前に呼ぶ */
  onOpen?: () => void;
  onSelect: (tag: string) => void;
}

/** 「タグを追加」のボタンと、タグ入力のポップオーバー。親は flex の行で、インライン展開は行の下へ全幅で入る。Esc は TagCombobox が受ける */
export function TagAddPopover({
  suggestions,
  excludeTags,
  disabled = false,
  boundary,
  inlineWhenNarrow = false,
  onOpen,
  onSelect,
}: TagAddPopoverProps) {
  const [mode, setMode] = useState<OpenMode | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const inlineRef = useRef<HTMLDivElement>(null);

  if (disabled && mode !== null) setMode(null);

  const popover = useMotionPopover({
    open: mode === "popover",
    onOpenChange: ({ open }) => {
      if (!open) {
        setMode(null);
        return;
      }
      if (mode === "inline") {
        closeInline();
        return;
      }
      onOpen?.();
      setMode(inlineWhenNarrow ? "inline" : "popover");
    },
    disabled,
    positioning: { placement: "bottom-start", boundary: boundary ?? undefined },
    initialFocusEl: () => popupRef.current?.querySelector("input") ?? null,
    onEscapeKeyDown: (event) => event.preventDefault(),
  });

  const closeInline = () => {
    const active = document.activeElement;
    if (active && (inlineRef.current?.contains(active) || triggerRef.current === active)) {
      triggerRef.current?.focus({ preventScroll: true });
    }
    setMode(null);
  };

  useDismissOnOutsidePress(
    mode === "inline",
    (target) => !!(inlineRef.current?.contains(target) || triggerRef.current?.contains(target)),
    closeInline,
  );

  const closeAndReturn = mode === "inline" ? closeInline : popover.closeAndReturn;
  const combobox = (
    <TagCombobox
      width="full"
      focusOnMount={mode === "inline"}
      suggestions={suggestions}
      excludeTags={excludeTags}
      disabled={disabled}
      canCreate={(tag) => normalizeTag(tag) !== null}
      onSelect={(tag) => {
        closeAndReturn();
        onSelect(tag);
      }}
      onCancel={closeAndReturn}
    />
  );

  return (
    <>
      <MotionPopoverRoot handle={popover}>
        <MotionPopoverTrigger>
          <IconButton
            ref={triggerRef}
            icon={I.add}
            label="タグを追加"
            size="xs"
            tone="muted"
            className="bg-paper-2 hover:bg-paper-3"
            aria-expanded={mode !== null}
          />
        </MotionPopoverTrigger>
        <PopoverPopup ref={popupRef} aria-label="タグを追加" className="w-[260px]">
          {combobox}
        </PopoverPopup>
      </MotionPopoverRoot>
      {mode === "inline" && (
        <div ref={inlineRef} className={cn(layerPanelClass, "mt-1 basis-full")}>
          {combobox}
        </div>
      )}
    </>
  );
}
