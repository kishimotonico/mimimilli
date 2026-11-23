import { queryOptions } from "@tanstack/react-query";
import { getScanRecord, getScanDiagnostics } from "./api";
import { SCAN_QUERY_KEYS } from "./queryKeys";

export const scanRecordQueryOptions = queryOptions({
  queryKey: SCAN_QUERY_KEYS.last(),
  queryFn: ({ signal }) => getScanRecord({ signal }),
});

export const scanDiagnosticsQueryOptions = queryOptions({
  queryKey: SCAN_QUERY_KEYS.diagnostics(),
  queryFn: ({ signal }) => getScanDiagnostics({ signal }),
});
