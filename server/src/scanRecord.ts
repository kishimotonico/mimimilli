import type {
  DataIntegrityWarning,
  MissingWork,
  ScanRecord,
  ScanRecordKind,
  ScanResult,
  UpdatedWork,
  Work,
  WorkChangeKind,
  WorkspacePath,
} from "@mimimilli/shared";

/** 記録のうち、いま存在する作品のstatus。存在しない作品は含まない */
export type ExistingWorkStatuses = ReadonlyMap<string, Work["status"]>;

/** 照合に使う、置き換わらない記録の写し */
export interface CapturedScanRecord {
  snapshotWorkIds(): string[];
  snapshot(existing: ExistingWorkStatuses): ScanRecord;
}

/**
 * 直近のスキャンで見つかったものの記録。メモリだけに持ち、寿命は次のスキャンかサーバー再起動まで。
 * 登録解除などで消えた作品は、書き込み側で外さず、読むときにcatalogと照合して落とす。
 */
export class ScanRecordStore {
  private finishedAt: string | null = null;
  private newWorkIds = new Set<string>();
  private updatedWorks: UpdatedWork[] = [];
  private missingWorks: MissingWork[] = [];
  private unreadablePaths: WorkspacePath[] = [];
  private integritySkippedIds: string[] = [];
  /**
   * 実行中のスキャンのあいだだけ持つ。完了時の新しい記録へ引き継ぐ操作の履歴。
   * added はスキャン結果に入らない候補からの登録、integrityResolved は存在のままでは判別できない読み直しの成功で、
   * どちらもcatalogとの照合からは導けない
   */
  private duringScan: { added: Set<string>; integrityResolved: Set<string> } | null = null;

  /** 実行中のスキャンの開始。以降の候補追加と読み直しを、完了後の記録へ反映する */
  beginScan(): void {
    this.duringScan = { added: new Set(), integrityResolved: new Set() };
  }

  /** 完了以外でスキャンが終わったとき、引き継ぎ用の履歴を捨てる */
  endScan(): void {
    this.duringScan = null;
  }

  /** 完了したスキャンの結果で記録を丸ごと置き換える */
  replace(result: ScanResult, finishedAt: string): void {
    const during = this.duringScan;
    this.finishedAt = finishedAt;
    this.newWorkIds = new Set([
      ...(result.startedWithEmptyCatalog ? [] : result.insertedWorkIds),
      ...(during?.added ?? []),
    ]);
    this.updatedWorks = structuredClone(result.updatedWorks);
    this.missingWorks = structuredClone(result.missingWorks);
    this.unreadablePaths = [...result.unreadablePaths];
    this.integritySkippedIds = (result.dataIntegrityWarning?.skippedWorkIds ?? []).filter(
      (workId) => !during?.integrityResolved.has(workId),
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

  /** 作品単位の読み直しで直った作品を、データ不整合から外す */
  resolveDataIntegrity(workId: string): void {
    this.integritySkippedIds = this.integritySkippedIds.filter((id) => id !== workId);
    this.duringScan?.integrityResolved.add(workId);
  }

  /** 現時点の記録の写し。照合の await の間に記録が置き換わっても、写しは変わらない */
  capture(): CapturedScanRecord {
    const copy = new ScanRecordStore();
    copy.finishedAt = this.finishedAt;
    copy.newWorkIds = new Set(this.newWorkIds);
    copy.updatedWorks = structuredClone(this.updatedWorks);
    copy.missingWorks = structuredClone(this.missingWorks);
    copy.unreadablePaths = [...this.unreadablePaths];
    copy.integritySkippedIds = [...this.integritySkippedIds];
    return copy;
  }

  /** snapshot の照合に必要な作品ID（更新済み・行方不明・データ不整合） */
  snapshotWorkIds(): string[] {
    return [
      ...this.updatedWorks.map((work) => work.workId),
      ...this.missingWorks.map((work) => work.workId),
      ...this.integritySkippedIds,
    ];
  }

  /**
   * 照合条件: 更新済みとデータ不整合は作品が存在すること。新たな行方不明は、存在してかつ行方不明のままであること
   * （同じIDの作品が復元されて見つかるようになっていれば、もう行方不明ではない）
   */
  snapshot(existing: ExistingWorkStatuses): ScanRecord {
    const skippedIds = this.integritySkippedIds.filter((id) => existing.has(id));
    const dataIntegrityWarning: DataIntegrityWarning | undefined =
      skippedIds.length > 0
        ? { skippedCount: skippedIds.length, skippedWorkIds: skippedIds }
        : undefined;
    return {
      finishedAt: this.finishedAt,
      updatedWorks: structuredClone(this.updatedWorks.filter((work) => existing.has(work.workId))),
      missingWorks: structuredClone(
        this.missingWorks.filter((work) => existing.get(work.workId) === "missing"),
      ),
      unreadablePaths: [...this.unreadablePaths],
      ...(dataIntegrityWarning ? { dataIntegrityWarning } : {}),
    };
  }

  /** GET /works の scanRecord 絞り込みが使う作品ID集合。作品一覧はIDで引くので、存在しない作品は自然に落ちる。updated は変化の種類で絞れる */
  workIds(kind: ScanRecordKind, change?: WorkChangeKind): string[] {
    if (kind === "new") return [...this.newWorkIds];
    return this.updatedWorks
      .filter((work) => change === undefined || work.changes.some((c) => c.kind === change))
      .map((work) => work.workId);
  }
}
