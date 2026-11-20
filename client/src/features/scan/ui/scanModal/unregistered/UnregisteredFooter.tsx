import { useRef, useState } from "react";
import { DLSITE_FETCH_ESTIMATE_MS_PER_CODE, type DlsiteRegistrationApply } from "@mimimilli/shared";
import { formatDlsiteFetchEstimate } from "../../../../../entities/dlsite/model/dlsiteBulkFrame";
import SplitButton, { type SplitButtonItem } from "../../../../../shared/ui/SplitButton";
import { ModalFooter } from "../../../../../shared/ui/Modal";
import type { FooterPlan } from "../../../model/unregisteredSelection";
import DlsiteFetchProgress from "./DlsiteFetchProgress";
import RegisterFieldsPopover, { REGISTER_APPLY_ALL } from "./RegisterFieldsPopover";

interface UnregisteredFooterProps {
  plan: FooterPlan;
  /** 選択の件数。▾の「選択を除外」の対象 */
  selectedCount: number;
  /** 追加できる件数。選択に取得中の行があるあいだは0 */
  addCount: number;
  /** 追加の対象にDLsite情報のない行が含まれる件数 */
  missingDlsiteCount: number;
  busy: boolean;
  onFetch: () => void;
  onCancelFetch: () => void;
  onRegister: (apply: DlsiteRegistrationApply) => void;
  onExclude: () => void;
}

export default function UnregisteredFooter({
  plan,
  selectedCount,
  addCount,
  missingDlsiteCount,
  busy,
  onFetch,
  onCancelFetch,
  onRegister,
  onExclude,
}: UnregisteredFooterProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const addable = !busy && addCount > 0;
  const items: SplitButtonItem[] = [];
  if (plan.kind === "fetch") {
    items.push({
      key: "add-without-fetch",
      label: "取得せずに追加",
      onSelect: () => onRegister(REGISTER_APPLY_ALL),
      disabled: !addable,
    });
  }
  items.push(
    {
      key: "pick",
      label: "項目を選んで追加…",
      onSelect: () => setPickerOpen(true),
      disabled: !addable,
    },
    {
      key: "exclude",
      label: "選択を除外",
      onSelect: onExclude,
      disabled: busy || selectedCount === 0,
    },
  );

  const primaryWidth = "min-w-[200px]";

  return (
    <ModalFooter className="gap-3">
      <span className="mr-auto whitespace-nowrap font-jp text-body text-ink-1">
        <span className="font-mono">{selectedCount}</span>件を選択
      </span>
      {plan.kind === "add" && missingDlsiteCount > 0 && (
        <span className="font-jp text-secondary text-ink-2">
          うち{missingDlsiteCount}件はDLsite情報なし
        </span>
      )}
      <DlsiteFetchProgress
        onCancel={onCancelFetch}
        idleHint={
          plan.kind === "fetch" && (
            <span className="font-jp text-caption text-ink-2">
              {plan.codes.length}件・
              {formatDlsiteFetchEstimate(plan.codes.length * DLSITE_FETCH_ESTIMATE_MS_PER_CODE)}
            </span>
          )
        }
      />
      {plan.kind !== "waiting" && (
        <div ref={anchorRef} className="relative inline-flex">
          <SplitButton
            className={primaryWidth}
            disabled={busy || selectedCount === 0}
            primaryDisabled={plan.kind === "add" && !addable}
            onClick={() => (plan.kind === "fetch" ? onFetch() : onRegister(REGISTER_APPLY_ALL))}
            items={items}
          >
            {plan.kind === "fetch"
              ? `DLsiteから取得 ${plan.codes.length}件`
              : `${addCount}件を追加`}
          </SplitButton>
          {pickerOpen && (
            <RegisterFieldsPopover
              count={addCount}
              disabled={!addable}
              anchorRef={anchorRef}
              onClose={() => setPickerOpen(false)}
              onSubmit={(apply) => {
                setPickerOpen(false);
                onRegister(apply);
              }}
            />
          )}
        </div>
      )}
    </ModalFooter>
  );
}
