import { useId, useRef, useState } from "react";
import { rootChildren, type SortId, type TagPrefix } from "@mimimilli/shared";
import { SORT_OPTIONS } from "../../../entities/library/types";
import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import Modal from "../../../shared/ui/Modal";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import {
  conditionRowText,
  draftOf,
  duplicateDraft,
  groupByFromKey,
  groupByKey,
  groupByOptions,
  groupDraft,
  smartFolderPermissions,
  toWrite,
  withoutRootChild,
  type SmartFolderDialogTarget,
  type SmartFolderDraft,
  type SmartFolderPermissions,
} from "../model/smartFolderEditing";

interface SmartFolderDialogProps {
  target: SmartFolderDialogTarget;
  /** 「『すべて』と同じ」の表示に使う「すべて」の既定の並び */
  allSort: SortId;
  tagPrefixes: readonly TagPrefix[];
  /** 保存できたら true。失敗はダイアログを開いたままにする */
  onSave: (draft: ReturnType<typeof toWrite>) => Promise<boolean>;
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
  const [draft, setDraft] = useState<SmartFolderDraft>(() => initialDraft(target, tagPrefixes));
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const sortRef = useRef<HTMLSelectElement>(null);
  const titleId = useId();
  const nameId = useId();
  const groupId = useId();
  const sortId = useId();
  const permissions =
    target.kind === "edit" ? smartFolderPermissions(target.folder) : FULL_PERMISSIONS;
  const dialog = useDialogModal({
    onClose,
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
        <IconButton icon={I.x} label="閉じる" size="sm" onClick={onClose} />
      </div>
      <div className="mll-dlg-b">
        <div className="mll-fld">
          <label htmlFor={nameId}>名前</label>
          <input
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
              setDraft({ ...draft, groupBy: groupByFromKey(event.target.value) })
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
        <div className="mll-fld">
          <label htmlFor={sortId}>既定の並び</label>
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
            {permissions.inheritSort && (
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
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          キャンセル
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={!canSave}>
          保存
        </Button>
      </div>
    </Modal>
  );
}
