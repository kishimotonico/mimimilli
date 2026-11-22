import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ALL_SMART_FOLDER_ID } from "@mimimilli/shared";
import { deleteSmartFolder } from "../../../entities/smart-folder/api";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import Button from "../../../shared/ui/Button";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import { I } from "../../../shared/ui/Icon";
import { useLibraryNavigation } from "../model/useLibraryNavigation";

/** 条件が読めないスマートフォルダー。開けないので、削除だけを出す（ADR-0040） */
export default function BrokenFolderPane({ folderId }: { folderId: string }) {
  const queryClient = useQueryClient();
  const { openFolder } = useLibraryNavigation();
  const deleteMutation = useMutation({
    mutationFn: () => deleteSmartFolder(folderId),
    onSuccess: async () => {
      openFolder(ALL_SMART_FOLDER_ID);
      await queryClient.invalidateQueries({ queryKey: SMART_FOLDER_QUERY_KEYS.all() });
    },
  });
  return (
    <div className="mll-results">
      <div className="mll-results__content">
        <CollectionStatus
          variant="list"
          kind="empty"
          message="このスマートフォルダーは読めません"
          action={
            <Button
              variant="primary"
              icon={I.x}
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              削除
            </Button>
          }
        />
      </div>
    </div>
  );
}
