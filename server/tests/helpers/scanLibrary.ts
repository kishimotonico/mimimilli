import type {
  DlsiteRegistrationApply,
  ScanCandidate,
  ScanCandidatesRegisterResponse,
  ScanResult,
} from "@mimimilli/shared";
import type { ScanExecution, ScanOptions, SettingsAdapter } from "../../src/adapter/index.ts";
import { ScanSession } from "../../src/scanSession.ts";

/** 追加で全項目を反映する（クライアントの既定） */
export const REGISTER_ALL: DlsiteRegistrationApply = {
  title: true,
  cover: true,
  tags: true,
  url: true,
};

type SessionAdapter = ConstructorParameters<typeof ScanSession>[0] & Pick<SettingsAdapter, "scan">;

const sessions = new WeakMap<object, ScanSession>();

/** adapterごとに1つの、スキャン結果の持ち主。サーバーが ScanJobManager 経由で持つものと同じ集約 */
export function scanSessionOf(adapter: SessionAdapter): ScanSession {
  let session = sessions.get(adapter);
  if (!session) {
    session = new ScanSession(adapter);
    sessions.set(adapter, session);
  }
  return session;
}

/** adapter.scan() を実行し、結果をそのadapterのセッションへ公開する */
export async function runScan(adapter: SessionAdapter, options?: ScanOptions): Promise<ScanResult> {
  const execution = await adapter.scan(options);
  scanSessionOf(adapter).publish(execution, new Date().toISOString());
  return execution.result;
}

export function listCandidates(adapter: SessionAdapter): Promise<ScanCandidate[]> {
  return scanSessionOf(adapter).listCandidates();
}

export function setCandidateRjCode(
  adapter: SessionAdapter,
  path: string,
  rjCode: string | null,
): Promise<ScanCandidate> {
  return scanSessionOf(adapter).setRjCode(path, rjCode);
}

export function registerCandidates(
  adapter: SessionAdapter,
  paths: string[],
  apply: DlsiteRegistrationApply,
): Promise<ScanCandidatesRegisterResponse> {
  return scanSessionOf(adapter).registerCandidates(paths, apply);
}

export function excludeCandidates(adapter: SessionAdapter, paths: string[]): Promise<void> {
  return scanSessionOf(adapter).excludeCandidates(paths);
}

export async function scanAndRegisterCandidates(
  adapter: SessionAdapter,
  options?: ScanOptions,
): Promise<ScanResult> {
  const scanned = await runScan(adapter, options);
  const candidates = await listCandidates(adapter);
  if (candidates.length > 0) {
    await registerCandidates(
      adapter,
      candidates.map((candidate) => candidate.path),
      REGISTER_ALL,
    );
  }
  return scanned;
}

/** 作品登録のDLsite関連フィールド。RJコードなし・DLsite由来の項目は反映しない */
export const NO_DLSITE = { rjCode: "", applyCover: false, applyUrl: false } as const;

/** スキャン結果だけを返すスタブ用。候補プールは空 */
export function scanExecutionOf(result: ScanResult): ScanExecution {
  return { result, candidatePool: [], rootIdentity: "/library" };
}
