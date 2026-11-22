import { useState } from "react";
import type { SmartFolder } from "@mimimilli/shared";
import Button from "../../../shared/ui/Button";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import { I } from "../../../shared/ui/Icon";
import { useSmartFolderEditor } from "../model/useSmartFolderEditor";

/** 条件が読めないスマートフォルダー。開けないので、削除だけを出す（ADR-0040） */
export default function BrokenFolderPane({ folder }: { folder: SmartFolder }) {
  const editor = useSmartFolderEditor();
  const [pending, setPending] = useState(false);
  const remove = async () => {
    setPending(true);
    await editor.remove(folder);
    setPending(false);
  };
  return (
    <div className="mll-results">
      <div className="mll-results__content">
        <CollectionStatus
          variant="list"
          kind="empty"
          message="このスマートフォルダーは読めません"
          action={
            <Button variant="primary" icon={I.x} disabled={pending} onClick={() => void remove()}>
              削除
            </Button>
          }
        />
      </div>
    </div>
  );
}
