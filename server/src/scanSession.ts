import type {
  DlsiteRegistrationApply,
  ScanCandidateBody,
  ScanCandidateFolder,
  ScanCandidatesRegisterResponse,
  ScanRecord,
} from "@mimimilli/shared";
import type { DataAdapter, ScanExecution } from "./adapter/index.ts";
import { CandidatePoolChangedError } from "./errors.ts";
import { ScanRecordStore } from "./scanRecord.ts";

type SessionAdapter = Pick<
  DataAdapter,
  | "candidateRootIdentity"
  | "candidateAvailability"
  | "describeCandidates"
  | "registerCandidateFolder"
  | "getWorkStatuses"
  | "excludeScanCandidates"
  | "listScanCandidateExclusions"
  | "restoreScanCandidateExclusions"
>;

/**
 * 直近のスキャンの結果の持ち主。候補プール・直したRJコード・スキャンの記録を持つ。
 * プールと記録はスキャン完了のたびに同期的にまとめて差し替わり、メモリだけにあって寿命は次のスキャンまで。
 * 直したRJコードはサーバー再起動まで持ち、候補から登録したときと、プールから外れたときに消える。
 */
export class ScanSession {
  readonly record = new ScanRecordStore();
  private readonly adapter: SessionAdapter;
  private pool: ReadonlyMap<string, ScanCandidateFolder> = new Map();
  private rootIdentity: string | null = null;
  /** 値がnullのエントリはRJコードなしの明示 */
  private readonly rjCodeOverrides = new Map<string, string | null>();

  constructor(adapter: SessionAdapter) {
    this.adapter = adapter;
  }

  /** 完了したスキャンの結果を公開する。プールの差し替えと記録の置き換えのあいだに await を入れない */
  publish(execution: ScanExecution, finishedAt: string): void {
    this.pool = new Map(execution.candidatePool.map((folder) => [folder.path, folder]));
    this.rootIdentity = execution.rootIdentity;
    for (const path of this.rjCodeOverrides.keys()) {
      if (!this.pool.has(path)) this.rjCodeOverrides.delete(path);
    }
    this.record.replace(execution.result, finishedAt);
  }

  /** 直近のスキャンの記録。消えた作品はcatalogと照合して落とす */
  async recordSnapshot(): Promise<ScanRecord> {
    const captured = this.record.capture();
    const existing = await this.adapter.getWorkStatuses(captured.snapshotWorkIds());
    return captured.snapshot(existing);
  }

  /** root再設定の開始。rootが変わるなら候補を捨てる。記録は常に捨てる */
  beginRootReconfiguration(rootChanged: boolean): void {
    if (rootChanged) this.discardCandidates();
    this.record.reset();
  }

  reset(): void {
    this.discardCandidates();
    this.record.reset();
  }

  private discardCandidates(): void {
    this.pool = new Map();
    this.rootIdentity = null;
    this.rjCodeOverrides.clear();
  }

  private async assertRootMatches(): Promise<void> {
    const current = await this.adapter.candidateRootIdentity();
    if (this.rootIdentity === null || current !== this.rootIdentity) {
      throw new CandidatePoolChangedError();
    }
  }

  private effectiveRjCode(folder: ScanCandidateFolder): string | null {
    return this.rjCodeOverrides.has(folder.path)
      ? (this.rjCodeOverrides.get(folder.path) ?? null)
      : folder.detectedRjCode;
  }

  /** 直して「なし」にしたときは空文字で明示する。検出も上書きもなければnull */
  private registrationRjCode(folder: ScanCandidateFolder): string | null {
    if (this.rjCodeOverrides.has(folder.path)) return this.rjCodeOverrides.get(folder.path) ?? "";
    return folder.detectedRjCode;
  }

  private select(
    paths: readonly string[],
    isCandidate: (folder: ScanCandidateFolder) => boolean,
  ): ScanCandidateFolder[] {
    return paths.map((path) => {
      const folder = this.pool.get(path);
      if (!folder || !isCandidate(folder)) throw new CandidatePoolChangedError();
      return folder;
    });
  }

  /** scanCompleted が false のとき候補は空で、スキャンが完了して候補が0件のときとは別の状態 */
  async listCandidates(): Promise<{ scanCompleted: boolean; candidates: ScanCandidateBody[] }> {
    const scanCompleted = this.record.hasFinishedScan();
    if (this.pool.size === 0) return { scanCompleted, candidates: [] };
    const [isCandidate, describe] = await Promise.all([
      this.adapter.candidateAvailability(),
      this.adapter.describeCandidates(),
    ]);
    return {
      scanCompleted,
      candidates: [...this.pool.values()]
        .filter(isCandidate)
        .map((folder) => this.toCandidate(folder, describe)),
    };
  }

  private toCandidate(
    folder: ScanCandidateFolder,
    describe: Awaited<ReturnType<SessionAdapter["describeCandidates"]>>,
  ): ScanCandidateBody {
    const rjCode = this.effectiveRjCode(folder);
    return {
      path: folder.path,
      inferredTitle: folder.inferredTitle,
      audioFileCount: folder.audioFileCount,
      audioBreakdown: folder.audioBreakdown,
      rjCode,
      rjCodeEdited: this.rjCodeOverrides.has(folder.path),
      ...describe(rjCode),
    };
  }

  /** nullはRJコードなしの明示。検出値と同じ値に直したときは直した記録を残さない */
  async setRjCode(path: string, rjCode: string | null): Promise<ScanCandidateBody> {
    const [, isCandidate, describe] = await Promise.all([
      this.assertRootMatches(),
      this.adapter.candidateAvailability(),
      this.adapter.describeCandidates(),
    ]);
    const [folder] = this.select([path], isCandidate);
    if (rjCode === folder!.detectedRjCode) this.rjCodeOverrides.delete(folder!.path);
    else this.rjCodeOverrides.set(folder!.path, rjCode);
    return this.toCandidate(folder!, describe);
  }

  async registerCandidates(
    paths: string[],
    apply: DlsiteRegistrationApply,
  ): Promise<ScanCandidatesRegisterResponse> {
    const [, isCandidate] = await Promise.all([
      this.assertRootMatches(),
      this.adapter.candidateAvailability(),
    ]);
    const selected = this.select(paths, isCandidate);
    const registered: ScanCandidatesRegisterResponse["registered"] = [];
    const failures: ScanCandidatesRegisterResponse["failures"] = [];
    for (const folder of selected) {
      try {
        const { workId, coverSkipped } = await this.adapter.registerCandidateFolder(
          folder,
          this.registrationRjCode(folder),
          apply,
        );
        registered.push({ path: folder.path, workId, coverSkipped });
      } catch (error) {
        failures.push({
          path: folder.path,
          message: error instanceof Error ? error.message : "候補の登録に失敗しました",
        });
      }
    }
    for (const { path } of registered) this.rjCodeOverrides.delete(path);
    this.record.addNewWorks(registered.map((entry) => entry.workId));
    return { registered, failures };
  }

  async excludeCandidates(paths: string[]): Promise<void> {
    const [, isCandidate] = await Promise.all([
      this.assertRootMatches(),
      this.adapter.candidateAvailability(),
    ]);
    this.select(paths, isCandidate);
    await this.adapter.excludeScanCandidates(paths);
  }

  listExclusions(): Promise<string[]> {
    return this.adapter.listScanCandidateExclusions();
  }

  restoreExclusions(paths: string[]): Promise<void> {
    return this.adapter.restoreScanCandidateExclusions(paths);
  }
}
