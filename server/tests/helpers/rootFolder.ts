import type { DataAdapter } from "../../src/adapter/index.ts";
import { scanSessionOf } from "./scanLibrary.ts";

/** 再設定の開始と完了だけでrootを確定する。catalogの構築は各テストが scan で行う。 */
export async function configureRoot(
  adapter: Pick<
    DataAdapter,
    | "resolveRootFolder"
    | "beginRootReconfiguration"
    | "completeRootReconfiguration"
    | "scan"
    | "candidateRootIdentity"
    | "candidateAvailability"
    | "describeCandidates"
    | "registerCandidateFolder"
    | "excludeScanCandidates"
    | "listScanCandidateExclusions"
    | "restoreScanCandidateExclusions"
  >,
  rootFolder: string,
): Promise<void> {
  const { rootChanged } = await adapter.beginRootReconfiguration(
    await adapter.resolveRootFolder(rootFolder),
  );
  scanSessionOf(adapter).beginRootReconfiguration(rootChanged);
  await adapter.completeRootReconfiguration();
}
