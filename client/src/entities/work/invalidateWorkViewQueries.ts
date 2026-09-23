import type { QueryClient } from "@tanstack/react-query";
import { WORK_QUERY_KEYS } from "./queryKeys";
import { SMART_FOLDER_QUERY_KEYS } from "../smart-folder/queryKeys";
import { TAG_QUERY_KEYS } from "../tag/queryKeys";

export async function invalidateWorkViewQueries(queryClient: QueryClient, workId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.detail(workId), exact: true }),
    queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.all() }),
    queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.allFacets() }),
    queryClient.invalidateQueries({ queryKey: TAG_QUERY_KEYS.all() }),
    queryClient.invalidateQueries({ queryKey: SMART_FOLDER_QUERY_KEYS.allWorks() }),
  ]);
}
