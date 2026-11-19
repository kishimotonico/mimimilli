import type {
  DataIntegrityWarning,
  MissingWork,
  ScanRecord,
  ScanRecordKind,
  ScanResult,
  UpdatedWork,
  WorkChangeKind,
  WorkspacePath,
} from "@mimimilli/shared";

/** 直近のスキャンで見つかったものの記録。メモリだけに持ち、寿命は次のスキャンかサーバー再起動まで。 */
export class ScanRecordStore {
  private finishedAt: string | null = null;
  private newWorkIds = new Set<string>();
  private updatedWorks: UpdatedWork[] = [];
  private missingWorks: MissingWork[] = [];
  private unreadablePaths: WorkspacePath[] = [];
  private integritySkippedIds: string[] = [];
  /** 実行中のスキャンのあいだだけ持つ。完了時の新しい記録へ引き継ぐ操作の履歴 */
  private duringScan: {
    added: Set<string>;
    forgotten: Set<string>;
    integrityResolved: Set<string>;
  } | null = null;

  /** 実行中のスキャンの開始。以降の候補追加と登録解除・読み直しを、完了後の記録へ反映する */
  beginScan(): void {
    this.duringScan = { added: new Set(), forgotten: new Set(), integrityResolved: new Set() };
  }

  /** 完了以外でスキャンが終わったとき、引き継ぎ用の履歴を捨てる */
  endScan(): void {
    this.duringScan = null;
  }

  /** 完了したスキャンの結果で記録を丸ごと置き換える */
  replace(result: ScanResult, finishedAt: string): void {
    const during = this.duringScan;
    const forgotten = during?.forgotten ?? new Set<string>();
    const kept = (workId: string): boolean => !forgotten.has(workId);
    this.finishedAt = finishedAt;
    this.newWorkIds = new Set(
      [
        ...(result.startedWithEmptyCatalog ? [] : result.insertedWorkIds),
        ...(during?.added ?? []),
      ].filter(kept),
    );
    this.updatedWorks = structuredClone(result.updatedWorks.filter((work) => kept(work.workId)));
    this.missingWorks = structuredClone(result.missingWorks.filter((work) => kept(work.workId)));
    this.unreadablePaths = [...result.unreadablePaths];
    this.integritySkippedIds = (result.dataIntegrityWarning?.skippedWorkIds ?? []).filter(
      (workId) => kept(workId) && !during?.integrityResolved.has(workId),
    );
    this.duringScan = null;
  }

  reset(): void {
    this.finishedAt = null;
    this.newWorkIds = new Set();
    this.updatedWorks = [];
    this.missingWorks = [];
    this.unreadablePaths = [];
    this.integritySkippedIds = [];
    this.duringScan = null;
  }

  addNewWorks(workIds: string[]): void {
    for (const id of workIds) {
      this.newWorkIds.add(id);
      this.duringScan?.added.add(id);
    }
  }

  /** 登録解除された作品を、すべての項目から外す */
  forgetWork(workId: string): void {
    this.newWorkIds.delete(workId);
    if (this.duringScan) {
      this.duringScan.added.delete(workId);
      this.duringScan.forgotten.add(workId);
    }
    this.updatedWorks = this.updatedWorks.filter((work) => work.workId !== workId);
    this.missingWorks = this.missingWorks.filter((work) => work.workId !== workId);
    this.resolveDataIntegrity(workId);
  }

  /** 作品単位の読み直しで直った作品を、データ不整合から外す */
  resolveDataIntegrity(workId: string): void {
    this.integritySkippedIds = this.integritySkippedIds.filter((id) => id !== workId);
    this.duringScan?.integrityResolved.add(workId);
  }

  snapshot(): ScanRecord {
    const dataIntegrityWarning: DataIntegrityWarning | undefined =
      this.integritySkippedIds.length > 0
        ? {
            skippedCount: this.integritySkippedIds.length,
            skippedWorkIds: [...this.integritySkippedIds],
          }
        : undefined;
    return {
      finishedAt: this.finishedAt,
      updatedWorks: structuredClone(this.updatedWorks),
      missingWorks: structuredClone(this.missingWorks),
      unreadablePaths: [...this.unreadablePaths],
      ...(dataIntegrityWarning ? { dataIntegrityWarning } : {}),
    };
  }

  /** GET /works の scanRecord 絞り込みが使う作品ID集合。updated は変化の種類で絞れる */
  workIds(kind: ScanRecordKind, change?: WorkChangeKind): string[] {
    if (kind === "new") return [...this.newWorkIds];
    return this.updatedWorks
      .filter((work) => change === undefined || work.changes.some((c) => c.kind === change))
      .map((work) => work.workId);
  }
}
