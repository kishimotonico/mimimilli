import { useQuery } from "@tanstack/react-query";
import { scanDiagnosticsQueryOptions } from "../../../entities/scan/queryOptions";
import type { DataIntegrityCount } from "./sidebarRows";

/** DataIntegrityWarningBanner と同じ診断から、除外された作品数を取る */
export function useDataIntegrityCount(): DataIntegrityCount {
  const query = useQuery({
    ...scanDiagnosticsQueryOptions,
    select: (diagnostics) => diagnostics.dataIntegrityWorks.length,
  });
  if (query.isError || query.data === undefined) return { status: "unknown" };
  return { status: "ready", count: query.data };
}
