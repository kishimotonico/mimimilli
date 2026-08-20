import { buildBuiltinAxisTag, splitSelectedTags, type NormalizedTag } from "@mimimilli/shared";
import type { AppMode } from "../../../shared/model/appMode";
import { isViewAxis } from "../axisDefinitions";
import type { AxisId, SortId } from "../types";

export type { AppMode };

export interface LibraryUrlState {
  activeAxis: AxisId;
  selectedTags: NormalizedTag[];
  selectedWorkId: string | null;
  sort: SortId;
  q?: string;
}

export interface FilesUrlState {
  relPath: string[];
  selectedRelPath: string[] | null;
}

export type NavigationUrlState =
  | { mode: "library"; library: LibraryUrlState }
  | { mode: "files"; files: FilesUrlState }
  | { mode: "nowPlaying" }
  | { mode: "workDetail"; workId: string };

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
  if (value === "home") return null;
  if (isViewAxis(value as AxisId) || value === "tag") return value;
  if (value.startsWith("smart-")) {
    return value.length > "smart-".length ? value : null;
  }
  return value.toLowerCase();
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function parseAndValidateSelectedTags(rawValues: string[], warnings: string[]): NormalizedTag[] {
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

  if (segments[0] === "now-playing") {
    if (segments.length > 1) {
      warnings.push(`再生中画面の階層として不正な URL を拒否しました: ${url.pathname}`);
      return defaultResult(warnings);
    }
    const state: NavigationUrlState = { mode: "nowPlaying" };
    return { state, canonicalUrl: serializeNavigationUrl(state), warnings };
  }

  if (segments[0] === "work") {
    const workId = segments[1];
    if (segments.length !== 2 || !workId) {
      warnings.push(`作品詳細の階層として不正な URL を拒否しました: ${url.pathname}`);
      return defaultResult(warnings);
    }
    const state: NavigationUrlState = { mode: "workDetail", workId };
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

  if (state.mode === "nowPlaying") {
    return "/now-playing";
  }

  if (state.mode === "workDetail") {
    return `/work/${encodeURIComponent(state.workId)}`;
  }

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
