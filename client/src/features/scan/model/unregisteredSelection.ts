import { canonicalDlsiteProductCode, RJ_CODE_PATTERN, type ScanCandidate } from "@mimimilli/shared";
import type { ScanCandidateSelectionOverride } from "../../../entities/scan/model/atoms";
import type { CandidateDlsiteDisplay } from "./unregisteredDlsite";

export interface CandidateRowModel {
  candidate: ScanCandidate;
  display: CandidateDlsiteDisplay;
}

export function isProblemDisplay(display: CandidateDlsiteDisplay): boolean {
  return display.state === "not_found" || display.state === "failed";
}

export function problemCount(rows: readonly CandidateRowModel[]): number {
  return rows.filter(({ display }) => isProblemDisplay(display)).length;
}

/** 判断が要る行。DLsiteの取得結果が該当なし・失敗、RJコードが形式に合わない、行方不明の作品と同じRJコード。 */
export function needsJudgment({ candidate, display }: CandidateRowModel): boolean {
  return (
    isProblemDisplay(display) ||
    (candidate.rjCode !== null && !RJ_CODE_PATTERN.test(candidate.rjCode)) ||
    candidate.missingWorks.length > 0
  );
}

export type SelectionOverrides = ReadonlyMap<string, ScanCandidateSelectionOverride>;

export function isRowSelected(row: CandidateRowModel, overrides: SelectionOverrides): boolean {
  const override = overrides.get(row.candidate.path);
  const judged = needsJudgment(row);
  return override && override.judged === judged ? override.selected : !judged;
}

/** 判断が要るかどうかが上書きの時と食い違った行の上書きを消す。変わらなければ同じ Map を返す。 */
export function pruneStaleOverrides(
  rows: readonly CandidateRowModel[],
  overrides: SelectionOverrides,
): SelectionOverrides {
  let next: Map<string, ScanCandidateSelectionOverride> | null = null;
  for (const row of rows) {
    const override = overrides.get(row.candidate.path);
    if (!override || override.judged === needsJudgment(row)) continue;
    next ??= new Map(overrides);
    next.delete(row.candidate.path);
  }
  return next ?? overrides;
}

export function selectionOverride(
  row: CandidateRowModel,
  selected: boolean,
): ScanCandidateSelectionOverride {
  return { selected, judged: needsJudgment(row) };
}

/** 取得の対象。選択中でRJコードがあり未取得のものを、コードで重複なく数える。
 *  失敗・該当なしは含めない（行の「再試行」で取り直す）。 */
export function fetchTargetCodes(selectedRows: readonly CandidateRowModel[]): string[] {
  const codes = new Set<string>();
  for (const { candidate, display } of selectedRows) {
    if (candidate.rjCode === null || display.state !== "none") continue;
    codes.add(canonicalDlsiteProductCode(candidate.rjCode));
  }
  return [...codes];
}

export type FooterPlan = { kind: "fetch"; codes: string[] } | { kind: "waiting" } | { kind: "add" };

/** フッターの主ボタンが何をするか。未取得があれば取得、取得中の行が選択に残るあいだは追加を出さない。 */
export function footerPlan(selectedRows: readonly CandidateRowModel[]): FooterPlan {
  const codes = fetchTargetCodes(selectedRows);
  if (codes.length > 0) return { kind: "fetch", codes };
  if (hasFetchingRow(selectedRows)) return { kind: "waiting" };
  return { kind: "add" };
}

function hasFetchingRow(rows: readonly CandidateRowModel[]): boolean {
  return rows.some(({ display }) => display.state === "fetching");
}

/** 追加の対象。選択に取得中の行があるあいだは追加できない。 */
export function addTargets(selectedRows: readonly CandidateRowModel[]): CandidateRowModel[] {
  return hasFetchingRow(selectedRows) ? [] : [...selectedRows];
}

/** 追加の対象のうち、RJコードがあるのにDLsite情報を得ていない件数。 */
export function missingDlsiteCount(targets: readonly CandidateRowModel[]): number {
  return targets.filter(
    ({ candidate, display }) => candidate.rjCode !== null && display.state !== "fetched",
  ).length;
}
