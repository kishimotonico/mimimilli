// work entity のドメイン型と、タグ解析ユーティリティ。
// API 契約に属する型・関数は @mimimilli/shared を正典として re-export する。
// 複数 feature（library / player / scan）から参照される共有 entity。

export type {
  UrlEntry,
  Track,
  Playlist,
  Work,
  WorkSummary,
  FileEntry,
  DlsiteWorkInfo,
  ParsedTag,
} from "@mimimilli/shared";
export { parseTag } from "@mimimilli/shared";

const CIRCLE_TAG_PREFIX = "サークル/";

/**
 * 作品の構造化タグからサークル名を抽出する。
 * サークルタグが無ければ null（呼び出し側でフォールバック表示を決める）。
 */
export function getCircleName(work: { tags: string[] }): string | null {
  const tag = work.tags.find((t) => t.startsWith(CIRCLE_TAG_PREFIX));
  return tag ? tag.slice(CIRCLE_TAG_PREFIX.length) : null;
}
