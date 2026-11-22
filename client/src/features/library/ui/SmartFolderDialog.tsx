import { useId, useRef, useState } from "react";
import { NO_AUTOFILL_PROPS } from "../../../shared/ui/noAutofill";
import {
  ALL_SMART_FOLDER_ID,
  findSmartFolderTemplate,
  rootChildren,
  smartFolderPermissions,
  type GroupSortId,
  type SmartFolderPermissions,
  type SmartFolderWrite,
  type SortId,
  type TagPrefix,
} from "@mimimilli/shared";
import { GROUP_SORT_OPTIONS } from "../model/groupValueSort";
import { SORT_OPTIONS } from "../../../entities/library/types";
import { groupByFromKey, groupByKey } from "../../../entities/smart-folder/groupByKey";
import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import Modal from "../../../shared/ui/Modal";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import {
  conditionRowText,
  draftOf,
  duplicateDraft,
  groupByOptions,
  groupDraft,
  toWrite,
  withGroupBy,
  withoutRootChild,
  type SmartFolderDialogTarget,
  type SmartFolderDraft,
} from "../model/smartFolderEditing";

interface SmartFolderDialogProps {
  target: SmartFolderDialogTarget;
  /** 「すべて」の並び。読めないときは null（「すべて」と同じを選べない） */
  allSort: SortId | null;
  tagPrefixes: readonly TagPrefix[];
  /** 保存できたら true。失敗はダイアログを開いたままにする */
  onSave: (draft: SmartFolderWrite) => Promise<boolean>;
  onClose: () => void;
}

const FULL_PERMISSIONS: SmartFolderPermissions = {
  rename: true,
  editCondition: true,
  editGroupBy: true,
  inheritSort: true,
  remove: true,
  edit: true,
};

function initialDraft(target: SmartFolderDialogTarget, tagPrefixes: readonly TagPrefix[]) {
  if (target.kind === "edit") return draftOf(target.folder);
  if (target.kind === "duplicate") return duplicateDraft(target.folder);
  if (target.kind === "save") return target.draft;
  const first = groupByOptions(tagPrefixes, null)[0]!;
  return groupDraft(groupByFromKey(first.key)!);
}

function titleOf(target: SmartFolderDialogTarget): string {
  if (target.kind === "edit") return `「${target.folder.name}」を編集`;
  if (target.kind === "duplicate") return `「${target.folder.name}」を複製`;
  if (target.kind === "save") return "検索を保存";
  return "グループ分けを追加";
}

/** 「すべて」の並びが読めないときは「すべて」と同じを選べないので、継承の下書きは既定テンプレートの並びで始める */
function withSelectableSort(draft: SmartFolderDraft, allSort: SortId | null): SmartFolderDraft {
  if (draft.sort !== null || allSort !== null) return draft;
  return { ...draft, sort: findSmartFolderTemplate(ALL_SMART_FOLDER_ID)!.sort };
}

/** 括弧の中に括弧が入らないよう、並び名の（）は「・」に置き換える */
function sortLabel(sort: SortId): string {
  const label = SORT_OPTIONS.find((option) => option.id === sort)?.label ?? sort;
  return label.replace(/（(.*)）/, "・$1");
}

export default function SmartFolderDialog({
  target,
  allSort,
  tagPrefixes,
  onSave,
  onClose,
}: SmartFolderDialogProps) {
  const [initial] = useState(() => withSelectableSort(initialDraft(target, tagPrefixes), allSort));
  const [draft, setDraft] = useState<SmartFolderDraft>(initial);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const sortRef = useRef<HTMLSelectElement>(null);
  const titleId = useId();
  const nameId = useId();
  const groupId = useId();
  const sortId = useId();
  const groupSortId = useId();
  const permissions =
    target.kind === "edit" ? smartFolderPermissions(target.folder) : FULL_PERMISSIONS;
  const close = () => {
    if (!saving) onClose();
  };
  const dialog = useDialogModal({
    onClose: close,
    initialFocusRef: permissions.rename ? nameRef : sortRef,
  });

  const children = rootChildren(draft.condition);
  const options = groupByOptions(tagPrefixes, draft.groupBy);
  const canSave = !saving && draft.name.trim() !== "";

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const saved = await onSave(toWrite(draft));
    if (!saved) setSaving(false);
  };

  return (
    <Modal
      dialog={dialog}
      size={620}
      height="short"
      labelledBy={titleId}
      canBackdropClose={() => !saving}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="mll-dlg-h">
        <span id={titleId}>{titleOf(target)}</span>
        <IconButton icon={I.x} label="閉じる" size="sm" disabled={saving} onClick={close} />
      </div>
      <div className="mll-dlg-b">
        <div className="mll-fld">
          <label htmlFor={nameId}>名前</label>
          <input
            {...NO_AUTOFILL_PROPS}
            ref={nameRef}
            id={nameId}
            type="text"
            value={draft.name}
            placeholder="名前"
            disabled={!permissions.rename}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </div>
        <div className="mll-fld is-top">
          <span className="lb">条件</span>
          {children.length === 0 ? (
            <div className="mll-condsum">なし（すべての作品）</div>
          ) : (
            <div className="mll-condlist">
              {children.map((child, index) => (
                <div key={`${index}:${conditionRowText(child)}`} className="mll-condrow">
                  <span>{conditionRowText(child)}</span>
                  {permissions.editCondition && (
                    <IconButton
                      icon={I.x}
                      label="この条件を外す"
                      size="xs"
                      onClick={() =>
                        setDraft({ ...draft, condition: withoutRootChild(draft.condition, index) })
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mll-fld">
          <label htmlFor={groupId}>グループ分け</label>
          <select
            id={groupId}
            value={groupByKey(draft.groupBy)}
            disabled={!permissions.editGroupBy}
            onChange={(event) =>
              setDraft(withGroupBy(draft, groupByFromKey(event.target.value), initial))
            }
          >
            {target.kind !== "group" && <option value="">なし</option>}
            {options.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {draft.groupSort !== null && (
          <div className="mll-fld">
            <label htmlFor={groupSortId}>値の並び</label>
            <select
              id={groupSortId}
              value={draft.groupSort}
              onChange={(event) =>
                setDraft({ ...draft, groupSort: event.target.value as GroupSortId })
              }
            >
              {GROUP_SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="mll-fld">
          <label htmlFor={sortId}>{draft.groupBy === null ? "既定の並び" : "作品の並び"}</label>
          <select
            ref={sortRef}
            id={sortId}
            value={draft.sort ?? ""}
            onChange={(event) =>
              setDraft({
                ...draft,
                sort: event.target.value === "" ? null : (event.target.value as SortId),
              })
            }
          >
            {permissions.inheritSort && allSort !== null && (
              <option value="">{`「すべて」と同じ（${sortLabel(allSort)}）`}</option>
            )}
            {SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mll-dlg-f">
        <Button type="button" variant="quiet" size="sm" disabled={saving} onClick={close}>
          キャンセル
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={!canSave}>
          保存
        </Button>
      </div>
    </Modal>
  );
}
