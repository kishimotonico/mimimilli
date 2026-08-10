import { getParsed, putParsed } from "../../shared/api/http";
import { settingsSchema, type Settings } from "@mimimilli/shared";

export async function getSettings(): Promise<Settings> {
  return getParsed(settingsSchema, "/settings");
}

export async function setRootFolder(path: string): Promise<Settings> {
  return putParsed(settingsSchema, "/settings", { rootFolder: path });
}
