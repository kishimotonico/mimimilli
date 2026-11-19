import type { DlsiteRegistrationApply, ScanCandidate, ScanResult } from "@mimimilli/shared";
import type { ScanOptions } from "../../src/adapter/index.ts";

/** 追加で全項目を反映する（クライアントの既定） */
export const REGISTER_ALL: DlsiteRegistrationApply = {
  title: true,
  cover: true,
  tags: true,
  url: true,
};

export interface ScanRegisterAdapter {
  scan(options?: ScanOptions): Promise<ScanResult>;
  listScanCandidates(): Promise<ScanCandidate[]>;
  registerScanCandidates(paths: string[], apply: DlsiteRegistrationApply): Promise<unknown>;
}

export async function scanAndRegisterCandidates(
  adapter: ScanRegisterAdapter,
  options?: ScanOptions,
): Promise<ScanResult> {
  const scanned = await adapter.scan(options);
  const candidates = await adapter.listScanCandidates();
  if (candidates.length > 0) {
    await adapter.registerScanCandidates(
      candidates.map((candidate) => candidate.path),
      REGISTER_ALL,
    );
  }
  return scanned;
}

/** 作品登録のDLsite関連フィールド。RJコードなし・DLsite由来の項目は反映しない */
export const NO_DLSITE = { rjCode: "", applyCover: false, applyUrl: false } as const;
