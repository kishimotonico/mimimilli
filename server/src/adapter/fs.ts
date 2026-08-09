import type { FsListing } from "@mimimilli/shared";

export interface FsAdapter {
  /** path 省略時はルートフォルダー。ルート配下でない・存在しない場合は null */
  browseFs(path?: string): Promise<FsListing | null>;
}
