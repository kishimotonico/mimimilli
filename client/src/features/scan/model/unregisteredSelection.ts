import { canonicalDlsiteProductCode, type ScanCandidate } from "@mimimilli/shared";
import type { CandidateDlsiteDisplay } from "./unregisteredDlsite";

export interface CandidateRowModel {
  candidate: ScanCandidate;
  display: CandidateDlsiteDisplay;
}

/** 取得の対象。選択中でRJコードがあり未取得のものを、コードで重複なく数える。
 *  失敗は含めない（行の「再試行」で取り直す）。 */
export function fetchTargetCodes(selectedRows: readonly CandidateRowModel[]): string[] {
  const codes = new Set<string>();
  for (const { candidate, display } of selectedRows) {
    if (candidate.rjCode === null || display.state !== "none") continue;
    codes.add(canonicalDlsiteProductCode(candidate.rjCode));
  }
  return [...codes];
}

/** 追加の対象。取得中の候補は除く。 */
export function registerTargets(selectedRows: readonly CandidateRowModel[]): CandidateRowModel[] {
  return selectedRows.filter(({ display }) => display.state !== "fetching");
}

/** 追加の対象のうち、RJコードがあるのにDLsite情報を得ていない件数。 */
export function missingDlsiteCount(targets: readonly CandidateRowModel[]): number {
  return targets.filter(
    ({ candidate, display }) => candidate.rjCode !== null && display.state !== "fetched",
  ).length;
}

export function isProblemDisplay(display: CandidateDlsiteDisplay): boolean {
  return display.state === "not_found" || display.state === "failed";
}

export function problemCount(rows: readonly CandidateRowModel[]): number {
  return rows.filter(({ display }) => isProblemDisplay(display)).length;
}
