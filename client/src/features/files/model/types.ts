// files feature のドメイン型とロジック。
// 物理ファイルシステムのブラウズ（/api/fs）を前提に、表示用の種別・パス操作を提供する。
// React / API に依存しない（テスト容易性のため）。

import type { IconName } from "../../../shared/ui/Icon";

// ── /api/fs レスポンス型 ──────────────────────────────────────
// API 契約に属する型は @mimimilli/shared を正典として re-export する。

export type { FsEntry, FsListing } from "@mimimilli/shared";

// ── ファイル種別 ──────────────────────────────────────────────

export type FileKind = "dir" | "audio" | "image" | "video" | "pdf" | "text" | "other";

/** classifyFile が受け取る最小構造 */
interface Classifiable {
  isDir: boolean;
  mediaKind?: Exclude<FileKind, "dir"> | null;
}

/** 表示種別はサーバーが判定したmediaKindを使う。 */
export function classifyFile(entry: Classifiable): FileKind {
  if (entry.isDir) return "dir";
  return entry.mediaKind ?? "other";
}

/** 登録済み判定に使う最小構造 */
interface RegistrableEntry {
  isDir: boolean;
  workId: string | null;
  workRelPath: string | null;
}

/** フォルダー単位で作品登録済みか */
export function isWorkFolder(entry: RegistrableEntry): boolean {
  return entry.isDir && !!entry.workId;
}

/** 単一ファイル単位で作品登録済みか */
export function isSingleFileWork(entry: RegistrableEntry): boolean {
  return !entry.isDir && !!entry.workId && (entry.workRelPath === "" || entry.workRelPath === ".");
}

/** 種別 → Icon キー（shared/ui/Icon の I[...] に対応） */
export const FILE_KIND_ICON: Record<FileKind, IconName> = {
  dir: "folder",
  audio: "audio",
  image: "image",
  video: "video",
  pdf: "pdf",
  text: "text",
  other: "file",
};

/** 種別 → mle-row の修飾クラス（shell.css に定義済み） */
export const FILE_KIND_ROW_CLASS: Record<FileKind, string> = {
  dir: "is-folder",
  audio: "is-audio",
  image: "is-image",
  video: "is-video",
  pdf: "is-pdf",
  text: "",
  other: "",
};

/** 種別 → 日本語ラベル */
export const FILE_KIND_LABEL: Record<FileKind, string> = {
  dir: "フォルダー",
  audio: "音声",
  image: "画像",
  video: "動画",
  pdf: "PDF",
  text: "テキスト",
  other: "ファイル",
};

/** dir 優先 → 名前昇順（数値混在を考慮）でソートした新規配列を返す */
export function sortEntries<T extends { isDir: boolean; name: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, "ja", { numeric: true });
  });
}

/** エントリ配列を種別ごとに集計する（フォルダープレビューの内訳表示用） */
export function summarizeKinds(entries: Classifiable[]): { kind: FileKind; count: number }[] {
  const counts = new Map<FileKind, number>();
  for (const e of entries) {
    const k = classifyFile(e);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const order: FileKind[] = ["dir", "audio", "image", "video", "pdf", "text", "other"];
  return order.filter((k) => counts.has(k)).map((k) => ({ kind: k, count: counts.get(k)! }));
}

// ── パス操作（物理パスをルート起点の相対 segments で扱う） ──────

function pathSeparator(path: string): "/" | "\\" {
  return path.includes("\\") ? "\\" : "/";
}

function trimTrailingSeparator(path: string, separator: "/" | "\\"): string {
  if (path === separator || /^[A-Za-z]:\\$/.test(path)) return path;
  let end = path.length;
  while (end > 0 && path[end - 1] === separator) end -= 1;
  return path.slice(0, end);
}

/** 絶対パスをルート相対の segments に分解（root 自身 = []） */
export function relSegments(root: string, abs: string): string[] {
  const separator = pathSeparator(root);
  const r = trimTrailingSeparator(root, separator);
  if (abs === r) return [];
  const prefix = r.endsWith(separator) ? r : r + separator;
  if (!abs.startsWith(prefix)) return [];
  return abs.slice(prefix.length).split(separator).filter(Boolean);
}

/** ルートと相対 segments から絶対パスを再構成 */
export function joinPath(root: string, segments: string[]): string {
  const separator = pathSeparator(root);
  const r = trimTrailingSeparator(root, separator);
  if (segments.length === 0) return r;
  const prefix = r.endsWith(separator) ? r : r + separator;
  return prefix + segments.join(separator);
}

/** カレントディレクトリ取得の失敗種別。notFound=404（対象が存在しない）、error=5xx/通信失敗（再試行すれば回復しうる） */
export type FileLoadError = "notFound" | "error";

/** ルートの表示名（末尾セグメント。空なら "/"） */
export function rootLabel(root: string): string {
  const separator = pathSeparator(root);
  const normalized = trimTrailingSeparator(root, separator);
  return normalized.split(separator).filter(Boolean).pop() ?? separator;
}

export interface FilesSelectionMissingParams {
  /** カレントディレクトリ取得自体が404・5xx・通信失敗のいずれか */
  hasLoadError: boolean;
  /** カレントディレクトリ取得が初回ロード中 */
  isPending: boolean;
  selectedPath: string | null;
  cwd: string;
  entries: { path: string }[];
}

/**
 * カレントディレクトリの取得自体には成功したが、選択中パスがその一覧に存在しないかを判定する。
 * ライブラリのエラー詳細・スキャン要対応の「Filesで開く」（openPathInFilesAtom）は
 * 移動・削除済みの対象を指すことがある。
 * ディレクトリ取得自体の404/5xx/通信失敗（loadError）・初回ロード中は誤検知を避けるため false。
 * 選択が無い、またはカレントディレクトリ自身を指す（＝選択なし扱い）ときも false。
 */
export function isFilesSelectionMissing({
  hasLoadError,
  isPending,
  selectedPath,
  cwd,
  entries,
}: FilesSelectionMissingParams): boolean {
  if (hasLoadError || isPending) return false;
  if (selectedPath == null || selectedPath === cwd) return false;
  return !entries.some((entry) => entry.path === selectedPath);
}
