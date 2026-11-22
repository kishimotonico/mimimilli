import {
  ALL_SMART_FOLDER_ID,
  buildBuiltinPseudoTag,
  splitSelectedTags,
  type NormalizedTag,
} from "@mimimilli/shared";

export interface LibraryUrlState {
  /** スマートフォルダーの ID。URL だけでは存在を決められない（resolveLibraryView が突き合わせる） */
  folderId: string;
  /** グループ分けで選んだ値。null なら値一覧 */
  group: string | null;
  selectedTags: NormalizedTag[];
  selectedWorkId: string | null;
  q?: string;
}

export interface FilesUrlState {
  relPath: string[];
  selectedRelPath: string[] | null;
}

export type NavigationScreenUrlState =
  | { mode: "library"; library: LibraryUrlState }
  | { mode: "files"; files: FilesUrlState }
  | { mode: "workDetail"; workId: string };

/** 画面の URL に、再生中の層を表す `np=1` を足すかどうかを持つ */
export type NavigationUrlState = NavigationScreenUrlState & { np: boolean };

export interface NavigationParseResult {
  state: NavigationUrlState;
  canonicalUrl: string;
  warnings: string[];
}

export const DEFAULT_LIBRARY_URL_STATE: LibraryUrlState = {
  folderId: ALL_SMART_FOLDER_ID,
  group: null,
  selectedTags: [],
  selectedWorkId: null,
  q: "",
};

function defaultResult(warnings: string[]): NavigationParseResult {
  const state: NavigationUrlState = {
    mode: "library",
    library: { ...DEFAULT_LIBRARY_URL_STATE },
    np: false,
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

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function parseAndValidateSelectedTags(rawValues: string[], warnings: string[]): NormalizedTag[] {
  const { tags, yearValue, warnings: splitWarnings } = splitSelectedTags(uniqueNonEmpty(rawValues));
  for (const warning of splitWarnings) warnings.push(`選択タグを検証しました: ${warning}`);
  return yearValue !== null ? [...tags, buildBuiltinPseudoTag("year", yearValue)] : tags;
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
  const np = url.searchParams.get("np") === "1";

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
    if (segments.length > 2) {
      warnings.push(`スマートフォルダーの階層として不正な URL を拒否しました: ${url.pathname}`);
      return defaultResult(warnings);
    }
    const folderId = segments[1] ?? ALL_SMART_FOLDER_ID;
    const state: NavigationUrlState = {
      mode: "library",
      library: {
        folderId,
        group: url.searchParams.get("group") || null,
        selectedTags: parseAndValidateSelectedTags(url.searchParams.getAll("tags"), warnings),
        selectedWorkId: url.searchParams.get("work") || null,
        q: url.searchParams.get("q") ?? "",
      },
      np,
    };
    return { state, canonicalUrl: serializeNavigationUrl(state), warnings };
  }

  if (segments[0] === "work") {
    const workId = segments[1];
    if (segments.length !== 2 || !workId) {
      warnings.push(`作品詳細の階層として不正な URL を拒否しました: ${url.pathname}`);
      return defaultResult(warnings);
    }
    const state: NavigationUrlState = { mode: "workDetail", workId, np };
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
      np,
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
  let pathname: string;

  if (state.mode === "workDetail") {
    pathname = `/work/${encodeURIComponent(state.workId)}`;
  } else if (state.mode === "library") {
    const { folderId, group, selectedTags, selectedWorkId, q } = state.library;
    pathname = `/library/${encodeURIComponent(folderId)}`;
    if (group !== null) params.set("group", group);
    for (const tag of selectedTags) params.append("tags", tag);
    if (selectedWorkId) params.set("work", selectedWorkId);
    if (q) params.set("q", q);
  } else {
    const suffix = encodeSegments(state.files.relPath);
    pathname = suffix ? `/files/${suffix}` : "/files";
    if (state.files.selectedRelPath?.length) {
      params.set("sel", state.files.selectedRelPath.join("/"));
    }
  }

  if (state.np) params.set("np", "1");
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}
