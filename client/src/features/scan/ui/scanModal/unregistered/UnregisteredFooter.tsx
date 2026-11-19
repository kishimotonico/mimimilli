import { useRef, useState } from "react";
import type { DlsiteRegistrationApply } from "@mimimilli/shared";
import SplitButton from "../../../../../shared/ui/SplitButton";
import { ModalFooter } from "../../../../../shared/ui/Modal";
import RegisterFieldsPopover, { REGISTER_APPLY_ALL } from "./RegisterFieldsPopover";

interface UnregisteredFooterProps {
  registerCount: number;
  missingDlsiteCount: number;
  busy: boolean;
  onRegister: (apply: DlsiteRegistrationApply) => void;
}

export default function UnregisteredFooter({
  registerCount,
  missingDlsiteCount,
  busy,
  onRegister,
}: UnregisteredFooterProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const disabled = busy || registerCount === 0;

  return (
    <ModalFooter className="gap-3">
      {missingDlsiteCount > 0 && (
        <span className="font-jp text-secondary text-ink-2">
          うち{missingDlsiteCount}件はDLsite情報なし
        </span>
      )}
      <div ref={anchorRef} className="relative inline-flex">
        <SplitButton
          disabled={disabled}
          onClick={() => onRegister(REGISTER_APPLY_ALL)}
          items={[{ key: "pick", label: "項目を選んで追加…", onSelect: () => setPickerOpen(true) }]}
        >
          {registerCount}件を追加
        </SplitButton>
        {pickerOpen && (
          <RegisterFieldsPopover
            count={registerCount}
            disabled={disabled}
            anchorRef={anchorRef}
            onClose={() => setPickerOpen(false)}
            onSubmit={(apply) => {
              setPickerOpen(false);
              onRegister(apply);
            }}
          />
        )}
      </div>
    </ModalFooter>
  );
}
