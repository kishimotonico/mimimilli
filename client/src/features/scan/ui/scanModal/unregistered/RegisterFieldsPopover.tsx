import { useEffect, useRef, useState } from "react";
import type { DlsiteRegistrationApply } from "@mimimilli/shared";
import Button from "../../../../../shared/ui/Button";
import { usePopoverDismissal } from "../../../../../shared/ui/usePopoverDismissal";

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
  count: number;
  disabled: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onSubmit: (apply: DlsiteRegistrationApply) => void;
  onClose: () => void;
}

/** 追加で反映するDLsite情報の項目を選ぶ。開くたびに全項目ON。 */
export default function RegisterFieldsPopover({
  count,
  disabled,
  anchorRef,
  onSubmit,
  onClose,
}: RegisterFieldsPopoverProps) {
  const [apply, setApply] = useState<DlsiteRegistrationApply>(REGISTER_APPLY_ALL);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.querySelector("input")?.focus(), []);
  usePopoverDismissal({
    isOpen: true,
    onClose,
    anchorRef,
    boundaryRef: anchorRef,
  });

  return (
    <div
      ref={ref}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- <dialog> はトップレイヤーに出るためモーダル内のアンカー付きポップオーバーに使えず、role=dialog で名前付きの操作領域にする
      role="dialog"
      aria-label="追加する項目"
      className="absolute right-0 bottom-full z-10 mb-2 flex w-[220px] flex-col gap-2 rounded-[8px] border border-line-soft bg-paper-1 p-3 shadow-pop"
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
      <Button variant="primary" disabled={disabled} onClick={() => onSubmit(apply)}>
        {count}件を追加
      </Button>
    </div>
  );
}
