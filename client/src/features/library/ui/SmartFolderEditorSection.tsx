import type { ComponentProps } from "react";
import type { useLibrarySmartFolderEditor } from "../model/useLibrarySmartFolderEditor";
import SmartFolderEditorModal from "./SmartFolderEditorModal";

type ModalProps = ComponentProps<typeof SmartFolderEditorModal>;

interface SmartFolderEditorSectionProps {
  editor: ReturnType<typeof useLibrarySmartFolderEditor>;
  tagSuggestions: ModalProps["tagSuggestions"];
  tagPrefixes: ModalProps["tagPrefixes"];
}

/** スマートフォルダー編集モーダルの配線（開閉・エラー文言の組み立て・保存/削除の呼び出し）。 */
export default function SmartFolderEditorSection({
  editor,
  tagSuggestions,
  tagPrefixes,
}: SmartFolderEditorSectionProps) {
  const { state, close, saveMutation, deleteMutation } = editor;
  if (state.status === "closed") return null;

  return (
    <SmartFolderEditorModal
      folder={state.status === "edit" ? state.folder : null}
      tagSuggestions={tagSuggestions}
      tagPrefixes={tagPrefixes}
      isSaving={saveMutation.isPending}
      saveError={
        saveMutation.error instanceof Error
          ? saveMutation.error.message
          : saveMutation.error
            ? "保存に失敗しました"
            : null
      }
      isDeleting={deleteMutation.isPending}
      deleteError={
        deleteMutation.error instanceof Error
          ? deleteMutation.error.message
          : deleteMutation.error
            ? "削除に失敗しました"
            : null
      }
      onClose={() => {
        if (saveMutation.isPending || deleteMutation.isPending) return;
        close();
      }}
      onSave={(input) =>
        saveMutation.mutate({
          folder: state.status === "edit" ? state.folder : null,
          input,
        })
      }
      onDelete={state.status === "edit" ? () => deleteMutation.mutate(state.folder.id) : undefined}
    />
  );
}
