import type { DataAdapter } from "../../src/adapter/index.ts";

/** 再設定の開始と完了だけでrootを確定する。catalogの構築は各テストが scan で行う。 */
export async function configureRoot(
  adapter: Pick<
    DataAdapter,
    "resolveRootFolder" | "beginRootReconfiguration" | "completeRootReconfiguration"
  >,
  rootFolder: string,
): Promise<void> {
  await adapter.beginRootReconfiguration(await adapter.resolveRootFolder(rootFolder));
  await adapter.completeRootReconfiguration();
}
