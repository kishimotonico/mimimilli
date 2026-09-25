import { getParsed, postParsed } from "../../shared/api/http";
import {
  rootReconfigurationStateSchema,
  settingsSchema,
  type RootReconfigurationState,
  type Settings,
} from "@mimimilli/shared";

export async function getSettings(): Promise<Settings> {
  return getParsed(settingsSchema, "/settings");
}

export async function getRootReconfiguration(): Promise<RootReconfigurationState> {
  return getParsed(rootReconfigurationStateSchema, "/root-reconfiguration");
}

/** root再設定の開始と再試行。構築はサーバー側で進み、状態は getRootReconfiguration で追う。 */
export async function startRootReconfiguration(
  rootFolder: string,
): Promise<RootReconfigurationState> {
  return postParsed(rootReconfigurationStateSchema, "/root-reconfiguration", { rootFolder });
}
