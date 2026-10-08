import { useQuery } from "@tanstack/react-query";
import { workDetailQueryOptions } from "../../../entities/work/workDetailQueryOptions";

/** 単一ファイル作品の実タイトルを取得する。物理ファイル名からの推測（getWorkFolderDisplay）は
 *  タイトルと無関係なことが多いため、作品として登録済みのときはこちらを優先して使う。
 *  workId が null のときは取得しない。 */
export function useSingleFileWorkTitle(workId: string | null): string | undefined {
  const query = useQuery(workDetailQueryOptions(workId));
  return workId != null ? query.data?.title : undefined;
}
