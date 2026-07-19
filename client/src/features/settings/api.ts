// settings feature の API。ルートフォルダーと最終スキャン時刻の取得・更新。
// 依存方向: shared/api/http と自 feature の model のみを参照する。

import { getParsed, putParsed } from "../../shared/api/http";
import { settingsSchema, type Settings } from "@mimimilli/shared";

export type { Settings } from "./model";

export async function getSettings(): Promise<Settings> {
  return getParsed(settingsSchema, "/settings");
}

export async function setRootFolder(path: string): Promise<Settings> {
  return putParsed(settingsSchema, "/settings", { rootFolder: path });
}

export async function getRootFolder(): Promise<string | null> {
  const s = await getSettings();
  return s.rootFolder;
}

export async function getLastScanTime(): Promise<string | null> {
  const s = await getSettings();
  return s.lastScanTime;
}
