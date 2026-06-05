// files feature のドメイン型とロジック。
// 物理ファイルシステムのブラウズ（/api/fs）を前提に、種別判定とパス操作の pure functions を提供する。
// React / API に依存しない（テスト容易性のため）。

// ── /api/fs レスポンス型 ──────────────────────────────────────

export interface FsEntry {
  name: string;
  /** 絶対物理パス（次に browse する dir / 選択キー） */
  path: string;
  isDir: boolean;
  size: number;
  fileType: string;
  /** dir のとき子要素数 */
  childCount: number;
  /** dir が登録作品ルート、または file が作品配下のとき所属作品 ID */
  workId: string | null;
  /** file のとき所属作品からの相対パス（既存メディア配信 URL 用） */
  workRelPath: string | null;
}

export interface FsListing {
  /** この listing の dir 絶対パス */
  path: string;
  /** 親 dir 絶対パス（ルートなら null） */
  parent: string | null;
  /** この dir 自身が登録作品ルートなら作品 ID（cwd フォルダープレビュー用） */
  workId: string | null;
  entries: FsEntry[];
}

// ── ファイル種別 ──────────────────────────────────────────────

export type FileKind = "dir" | "audio" | "image" | "video" | "pdf" | "text" | "other";

const EXT_KIND: Record<string, FileKind> = {
  mp3: "audio", wav: "audio", flac: "audio", m4a: "audio", ogg: "audio", opus: "audio", aac: "audio",
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image", bmp: "image", avif: "image",
  mp4: "video", mov: "video", mkv: "video", webm: "video", avi: "video",
  pdf: "pdf",
  txt: "text", md: "text", lrc: "text", json: "text", vtt: "text", srt: "text",
};

const KNOWN_KINDS = new Set<FileKind>(["audio", "image", "video", "pdf", "text"]);

/** classifyFile が受け取る最小構造（FsEntry / FileEntry の両方が満たす） */
interface Classifiable {
  isDir: boolean;
  fileType?: string | null;
  name: string;
}

/** 表示種別を判定する。fileType を優先し、無ければ拡張子でフォールバック */
export function classifyFile(entry: Classifiable): FileKind {
  if (entry.isDir) return "dir";
  const ft = entry.fileType?.toLowerCase() as FileKind | undefined;
  if (ft && KNOWN_KINDS.has(ft)) return ft;
  const dot = entry.name.lastIndexOf(".");
  const ext = dot > 0 ? entry.name.slice(dot + 1).toLowerCase() : "";
  return EXT_KIND[ext] ?? "other";
}

/** 種別 → Icon キー（shared/ui/Icon の I[...] に対応） */
export const FILE_KIND_ICON: Record<FileKind, string> = {
  dir: "folder", audio: "audio", image: "image", video: "video", pdf: "pdf", text: "text", other: "file",
};

/** 種別 → mle-row の修飾クラス（shell.css に定義済み） */
export const FILE_KIND_ROW_CLASS: Record<FileKind, string> = {
  dir: "is-folder", audio: "is-audio", image: "is-image", video: "is-video", pdf: "is-pdf", text: "", other: "",
};

/** 種別 → 日本語ラベル */
export const FILE_KIND_LABEL: Record<FileKind, string> = {
  dir: "フォルダー", audio: "音声", image: "画像", video: "動画", pdf: "PDF", text: "テキスト", other: "ファイル",
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

/** 絶対パスをルート相対の segments に分解（root 自身 = []） */
export function relSegments(root: string, abs: string): string[] {
  const r = root.replace(/\/+$/, "");
  if (abs === r) return [];
  if (!abs.startsWith(r + "/")) return [];
  return abs.slice(r.length + 1).split("/").filter(Boolean);
}

/** ルートと相対 segments から絶対パスを再構成 */
export function joinPath(root: string, segments: string[]): string {
  const r = root.replace(/\/+$/, "");
  return segments.length === 0 ? r : `${r}/${segments.join("/")}`;
}

/** ルートの表示名（末尾セグメント。空なら "/"） */
export function rootLabel(root: string): string {
  return root.split("/").filter(Boolean).pop() ?? "/";
}
