import type { ScanResult } from "@mimimilli/shared";
import type { ScanOptions } from "../../src/adapter/index.ts";

export interface ScanRegisterAdapter {
  scan(options?: ScanOptions): Promise<ScanResult>;
  registerScanCandidates(paths: string[]): Promise<unknown>;
}

export async function scanAndRegisterCandidates(
  adapter: ScanRegisterAdapter,
  options?: ScanOptions,
): Promise<ScanResult> {
  const scanned = await adapter.scan(options);
  if (scanned.candidates.length > 0) {
    await adapter.registerScanCandidates(scanned.candidates.map((candidate) => candidate.path));
  }
  return scanned;
}
