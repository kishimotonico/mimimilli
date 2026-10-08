import { queryOptions } from "@tanstack/react-query";
import { getLastScanResult, getScanDiagnostics } from "./api";
import { SCAN_QUERY_KEYS } from "./queryKeys";

export const scanLastResultQueryOptions = queryOptions({
  queryKey: SCAN_QUERY_KEYS.last(),
  queryFn: () => getLastScanResult(),
});

export const scanDiagnosticsQueryOptions = queryOptions({
  queryKey: SCAN_QUERY_KEYS.diagnostics(),
  queryFn: () => getScanDiagnostics(),
});
