import type { ScanCandidate, ScanCandidateRegisterItem, ScanResult } from "@mimimilli/shared";
import type { ScanOptions } from "../../src/adapter/index.ts";

export interface ScanRegisterAdapter {
  scan(options?: ScanOptions): Promise<ScanResult>;
  listScanCandidates(): Promise<ScanCandidate[]>;
  registerScanCandidates(items: ScanCandidateRegisterItem[]): Promise<unknown>;
}

export async function scanAndRegisterCandidates(
  adapter: ScanRegisterAdapter,
  options?: ScanOptions,
): Promise<ScanResult> {
  const scanned = await adapter.scan(options);
  const candidates = await adapter.listScanCandidates();
  if (candidates.length > 0) {
    await adapter.registerScanCandidates(candidates.map((candidate) => ({ path: candidate.path })));
  }
  return scanned;
}
