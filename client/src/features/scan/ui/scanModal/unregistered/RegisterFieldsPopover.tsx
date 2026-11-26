import { useState } from "react";
import type { DlsiteRegistrationApply } from "@mimimilli/shared";
import Button from "../../../../../shared/ui/Button";
import {
  MotionPopoverRoot,
  PopoverPopup,
  useMotionPopover,
} from "../../../../../shared/ui/popover/MotionPopover";

export const REGISTER_APPLY_ALL: DlsiteRegistrationApply = {
  title: true,
  cover: true,
  tags: true,
  url: true,
};

const FIELDS: { key: keyof DlsiteRegistrationApply; label: string }[] = [
  { key: "title", label: "タイトル" },
  { key: "cover", label: "カバー" },
  { key: "tags", label: "タグ" },
  { key: "url", label: "URL" },
];

interface RegisterFieldsPopoverProps {
  open: boolean;
  count: number;
  disabled: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  triggerId: string;
  onSubmit: (apply: DlsiteRegistrationApply) => void;
  onClose: () => void;
}

/** 追加で反映するDLsite情報の項目を選ぶ。開くたびに全項目ON。 */
export default function RegisterFieldsPopover({
  open,
  count,
  disabled,
  anchorRef,
  triggerId,
  onSubmit,
  onClose,
}: RegisterFieldsPopoverProps) {
  const [apply, setApply] = useState<DlsiteRegistrationApply>(REGISTER_APPLY_ALL);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setApply(REGISTER_APPLY_ALL);
  }

  const handle = useMotionPopover({
    open,
    onOpenChange: ({ open }) => {
      if (!open) onClose();
    },
    ids: { trigger: triggerId },
    positioning: {
      placement: "top-end",
      getAnchorRect: () => anchorRef.current?.getBoundingClientRect() ?? null,
    },
  });

  return (
    <MotionPopoverRoot handle={handle}>
      <PopoverPopup
        origin="bottom right"
        aria-label="追加する項目"
        className="flex w-[220px] flex-col gap-2"
      >
        {FIELDS.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 font-jp text-body text-ink-1">
            <input
              type="checkbox"
              checked={apply[key]}
              onChange={() => setApply((previous) => ({ ...previous, [key]: !previous[key] }))}
            />
            {label}
          </label>
        ))}
        <Button
          variant="primary"
          disabled={disabled}
          onClick={() => {
            handle.closeAndReturn();
            onSubmit(apply);
          }}
        >
          {count}件を追加
        </Button>
      </PopoverPopup>
    </MotionPopoverRoot>
  );
}
