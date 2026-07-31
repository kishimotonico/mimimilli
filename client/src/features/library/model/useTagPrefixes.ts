import { useQuery } from "@tanstack/react-query";
import { TAG_QUERY_KEYS } from "../../../entities/tag/queryKeys";
import { listTagPrefixes } from "../api";

export function useTagPrefixes() {
  const query = useQuery({
    queryKey: TAG_QUERY_KEYS.prefixes(),
    queryFn: listTagPrefixes,
  });
  return { tagPrefixes: query.data ?? [], ...query };
}
