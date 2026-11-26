import { useRef, useState } from "react";
import type { DlsiteRegistrationApply } from "@mimimilli/shared";
import SplitButton from "../../../../../shared/ui/SplitButton";
import { Menu } from "@ark-ui/react/menu";
import { MenuLayerItem } from "../../../../../shared/ui/menu/MenuLayerItem";
import {
  MENU_COUNT_CLASS,
  MENU_LABEL_CLASS,
  MENU_SEPARATOR_CLASS,
  menuItemClass,
} from "../../../../../shared/ui/menu/menuStyles";
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
  onFilterMissingDlsite: () => void;
  busy: boolean;
  /** RJコードを保存している間は、その値に依存する取得と追加を止める */
  rjCodeSaving: boolean;
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
  onFilterMissingDlsite,
  busy,
  rjCodeSaving,
  onFetch,
  onCancelFetch,
  onRegister,
  onExclude,
}: UnregisteredFooterProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // 主ボタンの役割が変わったら、項目選択を閉じる（戻ったときに開き直さない）
  const [pickerPlanKind, setPickerPlanKind] = useState(plan.kind);
  if (pickerPlanKind !== plan.kind) {
    setPickerPlanKind(plan.kind);
    setPickerOpen(false);
  }
  const anchorRef = useRef<HTMLDivElement>(null);

  const addable = !busy && !rjCodeSaving && addCount > 0;
  const menu = (
    <>
      {plan.kind === "fetch" && (
        <Menu.Item
          value="add-without-fetch"
          disabled={!addable}
          onSelect={() => onRegister(REGISTER_APPLY_ALL)}
          className={menuItemClass()}
        >
          <span className={MENU_LABEL_CLASS}>取得せずに追加</span>
          <span aria-hidden="true" className={MENU_COUNT_CLASS}>{`${addCount}件`}</span>
        </Menu.Item>
      )}
      <MenuLayerItem
        value="pick"
        disabled={!addable}
        onSelect={() => setPickerOpen(true)}
        className={menuItemClass()}
      >
        <span className={MENU_LABEL_CLASS}>項目を選んで追加…</span>
      </MenuLayerItem>
      <Menu.Separator className={MENU_SEPARATOR_CLASS} />
      <Menu.Item
        value="exclude"
        disabled={busy || selectedCount === 0}
        onSelect={onExclude}
        className={menuItemClass({ danger: true })}
      >
        <span className={MENU_LABEL_CLASS}>選択を除外</span>
        <span aria-hidden="true" className={MENU_COUNT_CLASS}>{`${selectedCount}件`}</span>
      </Menu.Item>
    </>
  );

  return (
    <ModalFooter className="h-[58px] gap-3 border-line py-0">
      <span className="mr-auto whitespace-nowrap font-jp text-body text-ink-1">
        <span className="font-mono">{selectedCount}</span>件を選択
      </span>
      {plan.kind === "add" && missingDlsiteCount > 0 && (
        <span className="whitespace-nowrap font-jp text-secondary text-ink-2">
          うちDLsite情報なし{" "}
          <button
            type="button"
            onClick={onFilterMissingDlsite}
            className="font-mono text-acc-ink underline underline-offset-2 hover:text-ink-0"
          >
            {missingDlsiteCount}
          </button>
        </span>
      )}
      <DlsiteFetchProgress onCancel={onCancelFetch} />
      {plan.kind !== "waiting" && (
        <div ref={anchorRef} className="relative inline-flex">
          <SplitButton
            size="md"
            className="min-w-[200px]"
            disabled={selectedCount === 0}
            busy={busy}
            primaryDisabled={rjCodeSaving || (plan.kind === "add" && !addable)}
            onClick={() => (plan.kind === "fetch" ? onFetch() : onRegister(REGISTER_APPLY_ALL))}
            menu={menu}
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
              onClose={(reason) => {
                setPickerOpen(false);
                // 項目から開いた層なので、Esc で閉じたときはメニューのトリガー（▾）へ戻す
                if (reason === "escape") {
                  anchorRef.current
                    ?.querySelector<HTMLElement>('[aria-haspopup="menu"]')
                    ?.focus({ preventScroll: true });
                }
              }}
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
