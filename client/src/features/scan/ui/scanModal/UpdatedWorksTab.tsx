import ScanResultWorksTable from "./ScanResultWorksTable";
import { useInlineTitleEdit } from "./useInlineTitleEdit";
import { useScanResultWorks } from "./useScanResultWorks";

export interface UpdatedWorksTabProps {
  /** メタファイル更新で再投影された作品ID */
  workIds: string[];
}

export default function UpdatedWorksTab({ workIds }: UpdatedWorksTabProps) {
  const { works, error, truncatedTotal, queryKey } = useScanResultWorks(
    workIds,
    "更新された作品の読み込みに失敗しました",
  );
  const edit = useInlineTitleEdit(queryKey);

  return (
    <div className="flex flex-col gap-2">
      <p className="font-jp text-[11.5px] text-ink-2">
        スキャン時に作品情報ファイルの変更を取り込みました。
      </p>
      <ScanResultWorksTable
        works={works}
        caption="更新された作品"
        emptyMessage="今回更新された作品はありません。"
        errorMessage={error}
        truncatedTotal={truncatedTotal}
        totalIds={workIds.length}
        edit={edit}
      />
    </div>
  );
}
