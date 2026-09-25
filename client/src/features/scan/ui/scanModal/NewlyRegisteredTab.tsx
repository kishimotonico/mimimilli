import ScanResultWorksTable from "./ScanResultWorksTable";
import { useInlineTitleEdit } from "./useInlineTitleEdit";
import { useScanResultWorks } from "./useScanResultWorks";

export interface NewlyRegisteredTabProps {
  /** 今回ライブラリへ入った作品ID（自動登録分・候補承認分を集約済み） */
  workIds: string[];
}

export default function NewlyRegisteredTab({ workIds }: NewlyRegisteredTabProps) {
  const { works, error, truncatedTotal } = useScanResultWorks(
    workIds,
    "新規作品の読み込みに失敗しました",
  );
  const edit = useInlineTitleEdit();

  return (
    <div className="flex flex-col gap-2">
      <p className="font-jp text-secondary text-ink-2">
        今回ライブラリに入った作品です。作品情報ファイルがあったものは自動で、未登録から追加したものはその操作で入りました。タイトルをクリックすると直せます。
      </p>
      <ScanResultWorksTable
        works={works}
        caption="新規登録済みの作品"
        emptyMessage="新規に登録した作品はありません。"
        errorMessage={error}
        truncatedTotal={truncatedTotal}
        totalIds={workIds.length}
        edit={edit}
      />
    </div>
  );
}
