import type { AxisId, SortId } from "../../library/model/types";

export type AppMode = "library" | "files";

export interface LibraryUrlState {
  activeAxis: AxisId;
  drillValue: string | null;
  selectedTags: string[];
  selectedWorkId: string | null;
  sort: SortId;
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
  drillValue: null,
  selectedTags: [],
  selectedWorkId: null,
  sort: DEFAULT_SORT,
};

const AXES = new Set<AxisId>([
  "all",
  "recent",
  "added",
  "fav",
  "unplayed",
  "missing",
  "circle",
  "cv",
  "series",
  "cat",
  "tag",
  "year",
]);
const DRILL_AXES = new Set<AxisId>(["circle", "cv", "series", "cat", "year"]);
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
  if (AXES.has(value as AxisId)) return value as AxisId;
  if (value.startsWith("smart-") && value.length > "smart-".length) return value as AxisId;
  return null;
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
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

    const drillValue = segments[2] ?? null;
    if (segments.length > 3 || (drillValue !== null && !DRILL_AXES.has(axis))) {
      warnings.push(`軸の階層として不正な URL を拒否しました: ${url.pathname}`);
      return defaultResult(warnings);
    }

    let selectedTags = uniqueNonEmpty(url.searchParams.getAll("tags"));
    if (axis !== "tag" && selectedTags.length > 0) {
      warnings.push("tag 軸以外の tags query を無視しました");
      selectedTags = [];
    }

    const selectedWorkId = url.searchParams.get("work") || null;
    const sortValue = url.searchParams.get("sort");
    const sort = sortValue && SORTS.has(sortValue as SortId) ? (sortValue as SortId) : DEFAULT_SORT;
    if (sortValue && sort === DEFAULT_SORT && sortValue !== DEFAULT_SORT) {
      warnings.push(`存在しない sort を既定値へ戻しました: ${sortValue}`);
    }

    const state: NavigationUrlState = {
      mode: "library",
      library: { activeAxis: axis, drillValue, selectedTags, selectedWorkId, sort },
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
    const { activeAxis, drillValue, selectedTags, selectedWorkId, sort } = state.library;
    let pathname = `/library/${encodeURIComponent(activeAxis)}`;
    if (drillValue !== null) pathname += `/${encodeURIComponent(drillValue)}`;
    if (activeAxis === "tag") {
      for (const tag of selectedTags) params.append("tags", tag);
    }
    if (selectedWorkId) params.set("work", selectedWorkId);
    if (sort !== DEFAULT_SORT) params.set("sort", sort);
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
