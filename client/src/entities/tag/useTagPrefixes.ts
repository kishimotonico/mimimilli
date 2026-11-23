import { useQuery } from "@tanstack/react-query";
import { listTagPrefixes } from "./api";
import { TAG_QUERY_KEYS } from "./queryKeys";

export function useTagPrefixes() {
  const query = useQuery({
    queryKey: TAG_QUERY_KEYS.prefixes(),
    queryFn: ({ signal }) => listTagPrefixes({ signal }),
  });
  return { tagPrefixes: query.data ?? [], ...query };
}
