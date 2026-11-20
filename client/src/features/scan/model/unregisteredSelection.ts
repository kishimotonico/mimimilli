import { canonicalDlsiteProductCode, type ScanCandidate } from "@mimimilli/shared";
import type { ScanCandidateSelectionOverride } from "../../../entities/scan/model/atoms";
import type { CandidateDlsiteDisplay } from "./unregisteredDlsite";

export interface CandidateRowModel {
  candidate: ScanCandidate;
  display: CandidateDlsiteDisplay;
  /** 編集中に確定できなかった形式エラーの値が残っている。候補には保存されていない */
  invalidRj?: boolean;
}

/** 行に出す名前。取得済みでタイトルがあればDLsiteのタイトル、なければフォルダー名 */
export function rowTitle({ candidate, display }: CandidateRowModel): string {
  return display.state === "fetched" && display.title ? display.title : candidate.inferredTitle;
}

function isProblemDisplay(display: CandidateDlsiteDisplay): boolean {
  return display.state === "not_found" || display.state === "failed";
}

export function judgmentCount(rows: readonly CandidateRowModel[]): number {
  return rows.filter(needsJudgment).length;
}

/** 判断が要る行。DLsiteの取得結果が該当なし・失敗、RJコードが形式に合わない、行方不明の作品と同じRJコード。 */
export function needsJudgment({ candidate, display, invalidRj }: CandidateRowModel): boolean {
  return invalidRj === true || isProblemDisplay(display) || candidate.missingWorks.length > 0;
}

/** 形式に合わないRJコードの行は、直すまで選べない。 */
export function isRowSelectable(row: CandidateRowModel): boolean {
  return row.invalidRj !== true;
}

export type SelectionOverrides = ReadonlyMap<string, ScanCandidateSelectionOverride>;

function overrideApplies(row: CandidateRowModel, override: ScanCandidateSelectionOverride) {
  return override.judged === needsJudgment(row) && override.rjCode === row.candidate.rjCode;
}

export function isRowSelected(row: CandidateRowModel, overrides: SelectionOverrides): boolean {
  if (!isRowSelectable(row)) return false;
  const override = overrides.get(row.candidate.path);
  return override && overrideApplies(row, override) ? override.selected : !needsJudgment(row);
}

/** 判断が要るかどうか、またはRJコードが上書きの時と食い違った行の上書きを消す。形式エラーの値が残っている行は、直すか戻すまでの一時的な状態なので消さない。変わらなければ同じ Map を返す。 */
export function pruneStaleOverrides(
  rows: readonly CandidateRowModel[],
  overrides: SelectionOverrides,
): SelectionOverrides {
  let next: Map<string, ScanCandidateSelectionOverride> | null = null;
  for (const row of rows) {
    const override = overrides.get(row.candidate.path);
    if (!override || row.invalidRj || overrideApplies(row, override)) continue;
    next ??= new Map(overrides);
    next.delete(row.candidate.path);
  }
  return next ?? overrides;
}

export function selectionOverride(
  row: CandidateRowModel,
  selected: boolean,
): ScanCandidateSelectionOverride {
  return { selected, judged: needsJudgment(row), rjCode: row.candidate.rjCode };
}

/** 取得の対象。選択中でRJコードの形式に合い、未取得・該当なし・失敗のものを、コードで重複なく数える。
 *  該当なし・失敗の行を含むときは force で取り直す（ADR-0033）。 */
export function fetchTarget(selectedRows: readonly CandidateRowModel[]): {
  codes: string[];
  force: boolean;
} {
  const codes = new Set<string>();
  let force = false;
  for (const { candidate, display } of selectedRows) {
    if (candidate.rjCode === null) continue;
    if (display.state === "none") codes.add(canonicalDlsiteProductCode(candidate.rjCode));
    else if (isProblemDisplay(display)) {
      codes.add(canonicalDlsiteProductCode(candidate.rjCode));
      force = true;
    }
  }
  return { codes: [...codes], force };
}

export type FooterPlan =
  | { kind: "fetch"; codes: string[]; force: boolean }
  | { kind: "waiting" }
  | { kind: "add" };

/** フッターの主ボタンが何をするか。取得できる行があれば取得、取得中の行が選択に残るあいだは追加を出さない。 */
export function footerPlan(selectedRows: readonly CandidateRowModel[]): FooterPlan {
  const { codes, force } = fetchTarget(selectedRows);
  if (codes.length > 0) return { kind: "fetch", codes, force };
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

/** 追加の対象のうちDLsite情報のない行。RJコードのない行も含む。 */
export function missingDlsiteRows(targets: readonly CandidateRowModel[]): CandidateRowModel[] {
  return targets.filter(({ display }) => display.state !== "fetched");
}
