// work entity のドメイン型と、タグ解析ユーティリティ。
// API 契約に属する型・関数は @mimimilli/shared を正典として re-export する。
// 複数 feature（library / player / scan）から参照される共有 entity。

export type {
  UrlEntry,
  Track,
  ResolvedTrack,
  Playlist,
  ResolvedPlaylist,
  Work,
  WorkListItem,
  WorkSummary,
  FileEntry,
  DlsiteWorkInfo,
  ParsedTag,
} from "@mimimilli/shared";
export { parseTag, extractCircleName } from "@mimimilli/shared";

import { extractCircleName } from "@mimimilli/shared";

/**
 * 作品の構造化タグからサークル名を抽出する。
 * サークルタグが無ければ null（呼び出し側でフォールバック表示を決める）。
 * 複数サークルタグがある場合の代表選出は shared の extractCircleName（サーバー側と同一ロジック）に委ねる。
 */
export function getCircleName(work: {
  tags?: string[];
  circleName?: string | null;
}): string | null {
  if (work.circleName !== undefined) return work.circleName;
  if (!work.tags) return null;
  return extractCircleName(work.tags);
}
