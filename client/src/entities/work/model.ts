// work entity のドメイン型と、タグ解析ユーティリティ。
// API 契約に属する型・関数は @mimikago/shared を正典として re-export する。
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
} from "@mimikago/shared";
export { parseTag } from "@mimikago/shared";
