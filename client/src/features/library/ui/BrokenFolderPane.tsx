import { useState } from "react";
import { smartFolderPermissions, type SmartFolder } from "@mimimilli/shared";
import Button from "../../../shared/ui/Button";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import { I } from "../../../shared/ui/Icon";
import { useSmartFolderEditor } from "../model/useSmartFolderEditor";

/** 開けないスマートフォルダー。行が読めないときは削除だけを出し（ADR-0040）、「すべて」は削除できない。
 *  「すべて」の並びを継承していてその並びが読めないときは、行自体は壊れていないので削除を出さない */
export default function BrokenFolderPane({
  folder,
  reason,
}: {
  folder: SmartFolder;
  reason: "folder" | "sort";
}) {
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
          message={
            reason === "folder"
              ? "このスマートフォルダーは読めません"
              : "「すべて」の並びが読めないため開けません"
          }
          action={
            reason === "folder" && smartFolderPermissions(folder).remove ? (
              <Button variant="primary" icon={I.x} disabled={pending} onClick={() => void remove()}>
                削除
              </Button>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
