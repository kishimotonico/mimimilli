import ScanResultWorksTable from "./ScanResultWorksTable";
import { useInlineTitleEdit } from "./useInlineTitleEdit";
import { useScanRecordWorks } from "./useScanRecordWorks";

export default function NewlyRegisteredTab() {
  const { works, total, loading, error } = useScanRecordWorks(
    "new",
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
        total={total}
        loading={loading}
        edit={edit}
      />
    </div>
  );
}
