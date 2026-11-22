import { getSmartFolderIcon } from "../../../entities/library/axisDefinitions";
import { I } from "../../../shared/ui/Icon";
import type { SmartFolderTemplate } from "@mimimilli/shared";

interface SidebarAddMenuProps {
  /** 絞り込みが無いときの「複製」の対象。無ければ出さない */
  duplicateName: string | null;
  templates: SmartFolderTemplate[];
  onDuplicate: () => void;
  onAddGroup: () => void;
  onAddTemplate: (templateId: string) => void;
}

/** 見出しの ＋ のメニュー。見出しの下に全幅で出す */
export default function SidebarAddMenu({
  duplicateName,
  templates,
  onDuplicate,
  onAddGroup,
  onAddTemplate,
}: SidebarAddMenuProps) {
  return (
    <div className="mll-sbmenu" role="menu">
      {duplicateName !== null && (
        <button type="button" role="menuitem" onClick={onDuplicate}>
          <I.bookmark size={13} />
          {`「${duplicateName}」を複製`}
        </button>
      )}
      <button type="button" role="menuitem" onClick={onAddGroup}>
        <I.tag size={13} />
        グループ分けを追加
      </button>
      <hr />
      <div className="mh">既定から追加</div>
      {templates.length > 0 ? (
        templates.map((template) => {
          const Icon = I[getSmartFolderIcon(template.id)];
          return (
            <button
              key={template.id}
              type="button"
              role="menuitem"
              onClick={() => onAddTemplate(template.id)}
            >
              <Icon size={13} />
              {template.name}
            </button>
          );
        })
      ) : (
        <div className="none">すべて追加済み</div>
      )}
    </div>
  );
}
