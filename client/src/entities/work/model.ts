// work entity のドメイン型と、タグ解析ユーティリティ。
// 複数 feature（library / player / scan）から参照される共有 entity。

export interface UrlEntry {
  label: string;
  url: string;
}

export interface Track {
  title: string;
  file: string;
  start?: number;
  end?: number;
}

export interface Playlist {
  name: string;
  tracks: Track[];
}

export interface Work {
  id: string;
  title: string;
  coverImage: string | null;
  defaultPlaylist: string | null;
  createdAt: string | null;
  status: string;
  physicalPath: string;
  totalDurationSec: number;
  addedAt: string;
  errorMessage: string | null;
  urls: UrlEntry[];
  tags: string[];
  playlists: Playlist[];
  bookmarked: boolean;
  lastPlayedAt: string | null;
  resumePosition: number;
  resumeTrackIndex: number;
}

export interface WorkSummary {
  id: string;
  title: string;
  coverImage: string | null;
  status: string;
  physicalPath: string;
  totalDurationSec: number;
  addedAt: string;
  errorMessage: string | null;
  urls: UrlEntry[];
  tags: string[];
  trackCount: number;
  bookmarked: boolean;
  lastPlayedAt: string | null;
}

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  fileType: string;
  children: FileEntry[];
}

export interface DlsiteWorkInfo {
  rjCode: string;
  title: string;
  circle: string | null;
  cvs: string[];
  genreTags: string[];
  coverUrl: string | null;
  url: string;
}

// ── タグ解析 ──────────────────────────────────────────────────

/** タグ文字列（"cv/水瀬なずな", "サークル/夜想曲", "バイノーラル" など）を解析する */
export interface ParsedTag {
  kind: "annotated" | "flat";
  prefix: string;
  value: string;
  raw: string;
}

export function parseTag(tag: string): ParsedTag {
  const idx = tag.indexOf("/");
  if (idx > 0) {
    return {
      kind: "annotated",
      prefix: tag.slice(0, idx).toLowerCase(),
      value: tag.slice(idx + 1),
      raw: tag,
    };
  }
  return { kind: "flat", prefix: "", value: tag, raw: tag };
}
