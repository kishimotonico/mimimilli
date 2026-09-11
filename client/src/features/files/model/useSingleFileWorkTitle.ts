import { useQuery } from "@tanstack/react-query";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { getWork } from "../../../entities/work/api";

/** 単一ファイル作品の実タイトルを取得する。物理ファイル名からの推測（getWorkFolderDisplay）は
 *  タイトルと無関係なことが多いため、作品として登録済みのときはこちらを優先して使う
 *  （TASK-428.18 / files-A-02）。workId が null のときは取得しない。 */
export function useSingleFileWorkTitle(workId: string | null): string | undefined {
  const query = useQuery({
    queryKey: WORK_QUERY_KEYS.detail(workId ?? ""),
    queryFn: () => getWork(workId!),
    enabled: workId != null,
  });
  return workId != null ? query.data?.title : undefined;
}
