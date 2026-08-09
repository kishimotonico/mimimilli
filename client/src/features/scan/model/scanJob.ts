import type { ScanJobSnapshot } from "@mimimilli/shared";

export function isTerminalScanJob(job: ScanJobSnapshot): boolean {
  return job.status === "completed" || job.status === "failed" || job.status === "cancelled";
}
