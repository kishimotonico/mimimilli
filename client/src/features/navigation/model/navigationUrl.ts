import { buildBuiltinAxisTag, splitSelectedTags } from "@mimimilli/shared";
import { isViewAxis } from "../../library/model/axisDefinitions";
import type { AxisId, SortId } from "../../library/model/types";

export type AppMode = "library" | "files";

export interface LibraryUrlState {
  activeAxis: AxisId;
  /** 全軸共通のタグフィルタ（ADR-0012 §2）。year 軸のような組み込み軸も
   *  "year/2024" 形式の擬似タグとしてここに載る */
  selectedTags: string[];
  selectedWorkId: string | null;
  sort: SortId;
  /** 検索キーワード。空文字はURLに出さない。省略時は復元経路未対応の呼び出し元向けに空扱い */
  q?: string;
}

export interface FilesUrlState {
  relPath: string[];
  selectedRelPath: string[] | null;
}

export type NavigationUrlState =
  | { mode: "library"; library: LibraryUrlState }
  | { mode: "files"; files: FilesUrlState };

export interface NavigationParseResult {
  state: NavigationUrlState;
  canonicalUrl: string;
  warnings: string[];
}

export const DEFAULT_SORT: SortId = "added-desc";

export const DEFAULT_LIBRARY_URL_STATE: LibraryUrlState = {
  activeAxis: "all",
  selectedTags: [],
  selectedWorkId: null,
  sort: DEFAULT_SORT,
  q: "",
};

// ビュー軸（ドリル不可）。それ以外のセグメントは tag / smart-* を除きファセット軸
// （year または任意の prefix 軸）として受理する（ADR-0005: 軸IDの動的化）
const SORTS = new Set<SortId>([
  "added-desc",
  "added-asc",
  "title-asc",
  "title-desc",
  "duration-desc",
  "duration-asc",
  "last-played",
  "random",
  "id-asc",
]);

function defaultResult(warnings: string[]): NavigationParseResult {
  const state: NavigationUrlState = {
    mode: "library",
    library: { ...DEFAULT_LIBRARY_URL_STATE },
  };
  return { state, canonicalUrl: serializeNavigationUrl(state), warnings };
}

function decodePathSegment(raw: string, warnings: string[]): string | null {
  try {
    const value = decodeURIComponent(raw);
    if (!isSafeRelativeSegment(value)) {
      warnings.push(`安全でないパス segment を拒否しました: ${raw}`);
      return null;
    }
    return value;
  } catch {
    warnings.push(`URL decode に失敗しました: ${raw}`);
    return null;
  }
}

function isSafeRelativeSegment(value: string): boolean {
  return (
    value.length > 0 &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("\0")
  );
}

function parseAxis(value: string): AxisId | null {
  if (isViewAxis(value as AxisId) || value === "tag" || value === "home") return value;
  if (value.startsWith("smart-")) {
    return value.length > "smart-".length ? value : null;
  }
  // ファセット軸（year / 任意 prefix）。prefix は正規形（小文字）で扱う
  return value.toLowerCase();
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

/** URLの tags= を検証する。UI操作は擬似タグの単一選択・既知軸を常に強制するが、
 *  URLは直接編集され得るため、ここで同じ制約を検証する（ADR-0012 §2）。
 *  未知の組み込み軸・複数の year 擬似タグ・正規化後に空になるタグは黙って残さず、
 *  警告付きで拒否・正規化する（splitSelectedTags の検証を shared から流用する）。 */
function parseAndValidateSelectedTags(rawValues: string[], warnings: string[]): string[] {
  const { tags, yearValue, warnings: splitWarnings } = splitSelectedTags(uniqueNonEmpty(rawValues));
  for (const warning of splitWarnings) warnings.push(`選択タグを検証しました: ${warning}`);
  return yearValue !== null ? [...tags, buildBuiltinAxisTag("year", yearValue)] : tags;
}

function parseSelectedRelPath(value: string, warnings: string[]): string[] | null {
  if (!value || value.startsWith("/") || value.startsWith("\\") || /^[A-Za-z]:/.test(value)) {
    warnings.push(`root 相対でない選択パスを拒否しました: ${value}`);
    return null;
  }
  const segments = value.split("/");
  if (!segments.every(isSafeRelativeSegment)) {
    warnings.push(`安全でない選択パスを拒否しました: ${value}`);
    return null;
  }
  return segments;
}

export function parseNavigationUrl(input: string | URL): NavigationParseResult {
  const url = input instanceof URL ? input : new URL(input, "http://mimimilli.local");
  const warnings: string[] = [];

  if (url.hash) warnings.push(`未対応の URL hash を削除しました: ${url.hash}`);

  if (url.pathname === "/") {
    return defaultResult(warnings);
  }

  const rawSegments = url.pathname.split("/").filter(Boolean);
  const segments: string[] = [];
  for (const raw of rawSegments) {
    const decoded = decodePathSegment(raw, warnings);
    if (decoded === null) return defaultResult(warnings);
    segments.push(decoded);
  }

  if (segments[0] === "library") {
    const axisValue = segments[1] ?? "all";
    const axis = parseAxis(axisValue);
    if (!axis) {
      warnings.push(`存在しないライブラリ軸を拒否しました: ${axisValue}`);
      return defaultResult(warnings);
    }

    if (segments.length > 2) {
      warnings.push(`軸の階層として不正な URL を拒否しました: ${url.pathname}`);
      return defaultResult(warnings);
    }

    const selectedTags = parseAndValidateSelectedTags(url.searchParams.getAll("tags"), warnings);

    const selectedWorkId = url.searchParams.get("work") || null;
    const sortValue = url.searchParams.get("sort");
    const sort = sortValue && SORTS.has(sortValue as SortId) ? (sortValue as SortId) : DEFAULT_SORT;
    if (sortValue && sort === DEFAULT_SORT && sortValue !== DEFAULT_SORT) {
      warnings.push(`存在しない sort を既定値へ戻しました: ${sortValue}`);
    }
    const q = url.searchParams.get("q") ?? "";

    const state: NavigationUrlState = {
      mode: "library",
      library: { activeAxis: axis, selectedTags, selectedWorkId, sort, q },
    };
    return { state, canonicalUrl: serializeNavigationUrl(state), warnings };
  }

  if (segments[0] === "files") {
    const selectedValues = url.searchParams.getAll("sel");
    if (selectedValues.length > 1) warnings.push("複数の sel query のうち先頭だけを使用しました");
    const selectedRelPath = selectedValues[0]
      ? parseSelectedRelPath(selectedValues[0], warnings)
      : null;
    const state: NavigationUrlState = {
      mode: "files",
      files: { relPath: segments.slice(1), selectedRelPath },
    };
    return { state, canonicalUrl: serializeNavigationUrl(state), warnings };
  }

  warnings.push(`存在しない画面 URL を拒否しました: ${url.pathname}`);
  return defaultResult(warnings);
}

function encodeSegments(segments: string[]): string {
  return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

export function serializeNavigationUrl(state: NavigationUrlState): string {
  const params = new URLSearchParams();

  if (state.mode === "library") {
    const { activeAxis, selectedTags, selectedWorkId, sort, q } = state.library;
    const pathname = `/library/${encodeURIComponent(activeAxis)}`;
    for (const tag of selectedTags) params.append("tags", tag);
    if (selectedWorkId) params.set("work", selectedWorkId);
    if (sort !== DEFAULT_SORT) params.set("sort", sort);
    if (q) params.set("q", q);
    const search = params.toString();
    return search ? `${pathname}?${search}` : pathname;
  }

  const suffix = encodeSegments(state.files.relPath);
  const pathname = suffix ? `/files/${suffix}` : "/files";
  if (state.files.selectedRelPath?.length) {
    params.set("sel", state.files.selectedRelPath.join("/"));
  }
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}
