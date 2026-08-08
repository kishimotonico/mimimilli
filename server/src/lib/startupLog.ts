import type { DataPaths } from "../adapters/real/dataRoot.ts";

export function buildStartupLogProperties(input: {
  adapterKind: string;
  dataPaths: DataPaths | undefined;
  logFilePath: string | null;
  scenario: string | undefined;
}): Record<string, string> {
  if (input.adapterKind === "real") {
    if (!input.dataPaths) {
      throw new Error("real adapter requires dataPaths");
    }
    if (input.logFilePath === null) {
      throw new Error("real adapter requires logFilePath");
    }
    return {
      adapter: "real",
      dataRoot: input.dataPaths.root,
      catalogDb: input.dataPaths.catalogDb,
      userDb: input.dataPaths.userDb,
      logFile: input.logFilePath,
    };
  }

  const properties: Record<string, string> = { adapter: "fixture" };
  if (input.scenario) {
    properties.scenario = input.scenario;
  }
  return properties;
}
