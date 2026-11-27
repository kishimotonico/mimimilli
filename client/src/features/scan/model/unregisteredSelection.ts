import { canonicalDlsiteProductCode, type ScanCandidate } from "@mimimilli/shared";
import type { ScanCandidateSelectionOverride } from "../../../entities/scan/model/atoms";
import type { CandidateDlsiteDisplay } from "./unregisteredDlsite";

export interface CandidateRowModel {
  candidate: ScanCandidate;
  display: CandidateDlsiteDisplay;
  /** この行が見ている取得結果の revision。ジョブがまだ結果を返していないコードは null */
  resultRevision: number | null;
  /** 編集中に確定できなかった形式エラーの値が残っている。候補には保存されていない */
  invalidRj?: boolean;
}

/** 行に出す名前。取得済みでタイトルがあればDLsiteのタイトル、なければフォルダー名 */
export function rowTitle({
  candidate,
  display,
}: Pick<CandidateRowModel, "candidate" | "display">): string {
  return display.state === "fetched" && display.title ? display.title : candidate.inferredTitle;
}

function isProblemDisplay(display: CandidateDlsiteDisplay): boolean {
  return display.state === "not_found" || display.state === "failed";
}

export function judgmentCount(rows: readonly CandidateRowModel[]): number {
  return rows.filter(needsJudgment).length;
}

/** 判断が要る行。DLsiteの取得結果が該当なし・失敗、RJコードが形式に合わない、行方不明の作品と同じRJコード。 */
export function needsJudgment(row: CandidateRowModel): boolean {
  return judgments(row).length > 0;
}

/** 形式に合わないRJコードの行は、直すまで選べない。 */
export function isRowSelectable(row: CandidateRowModel): boolean {
  return row.invalidRj !== true;
}

export type SelectionOverrides = ReadonlyMap<string, ScanCandidateSelectionOverride>;

/** 判断が要る理由。取得結果（失敗・該当なし）が理由のときは、その結果の revision まで含め、取り直して再び失敗すると別の理由になる。 */
function judgments(row: CandidateRowModel): string[] {
  const reasons: string[] = [];
  if (row.invalidRj === true) reasons.push("invalidRj");
  if (row.candidate.missingWorks.length > 0) reasons.push("missing");
  if (isProblemDisplay(row.display)) reasons.push(`result:${row.resultRevision}`);
  return reasons;
}

/** RJコードが同じで、今の判断の理由が上書きしたときの理由に収まるあいだ採る。新しい理由が出たら既定に戻る。 */
function overrideApplies(row: CandidateRowModel, override: ScanCandidateSelectionOverride) {
  return (
    override.rjCode === row.candidate.rjCode &&
    judgments(row).every((reason) => override.judgments.includes(reason))
  );
}

export function isRowSelected(row: CandidateRowModel, overrides: SelectionOverrides): boolean {
  if (!isRowSelectable(row)) return false;
  const override = overrides.get(row.candidate.path);
  return override && overrideApplies(row, override) ? override.selected : !needsJudgment(row);
}

export function selectionOverride(
  row: CandidateRowModel,
  selected: boolean,
): ScanCandidateSelectionOverride {
  return {
    selected,
    judgments: judgments(row),
    rjCode: row.candidate.rjCode,
  };
}

/** 取得の対象。選択中でRJコードの形式に合い、未取得・該当なし・失敗のもの、取得済みでカバーを取りに行っていないものを、コードで重複なく数える。
 *  該当なし・失敗の行を含むときは force で取り直す（ADR-0033）。 */
export function fetchTarget(selectedRows: readonly CandidateRowModel[]): {
  codes: string[];
  force: boolean;
} {
  const codes = new Set<string>();
  let force = false;
  for (const { candidate, display } of selectedRows) {
    if (candidate.rjCode === null) continue;
    if (
      display.state === "none" ||
      (display.state === "fetched" && display.cover.state === "missing")
    )
      codes.add(canonicalDlsiteProductCode(candidate.rjCode));
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
