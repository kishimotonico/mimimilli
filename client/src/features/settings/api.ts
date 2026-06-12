// settings feature の API。ルートフォルダーと最終スキャン時刻の取得・更新。
// 依存方向: shared/api/http と自 feature の model のみを参照する。

import { get, put } from "../../shared/api/http";
import type { Settings } from "./model";

export type { Settings } from "./model";

export async function getSettings(): Promise<Settings> {
  return get<Settings>("/settings");
}

export async function setRootFolder(path: string): Promise<Settings> {
  return put<Settings>("/settings", { rootFolder: path });
}

export async function getRootFolder(): Promise<string | null> {
  const s = await getSettings();
  return s.rootFolder;
}

export async function getLastScanTime(): Promise<string | null> {
  const s = await getSettings();
  return s.lastScanTime;
}
