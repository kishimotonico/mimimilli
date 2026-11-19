import ScanResultWorksTable from "./ScanResultWorksTable";
import { useInlineTitleEdit } from "./useInlineTitleEdit";
import { useScanRecordWorks } from "./useScanRecordWorks";

export default function UpdatedWorksTab() {
  const { works, total, loading, error } = useScanRecordWorks(
    "updated",
    "更新された作品の読み込みに失敗しました",
  );
  const edit = useInlineTitleEdit();

  return (
    <div className="flex flex-col gap-2">
      <p className="font-jp text-secondary text-ink-2">
        スキャン時に作品情報ファイルの変更を取り込みました。
      </p>
      <ScanResultWorksTable
        works={works}
        caption="更新された作品"
        emptyMessage="今回更新された作品はありません。"
        errorMessage={error}
        total={total}
        loading={loading}
        edit={edit}
      />
    </div>
  );
}
