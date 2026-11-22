import { createHash } from "node:crypto";
import {
  DEFAULT_TAG_PREFIXES,
  SMART_FOLDER_TEMPLATES,
  dlsiteFetchStateOfResolution,
  projectDlsiteState,
  toDlsiteLinkageStatus,
} from "@mimimilli/shared";
import type {
  DlsiteWorkInfo,
  DataIntegrityWarning,
  DlsiteCacheResolution,
  DlsiteCacheResolutionHead,
  DlsiteCoverSkipReason,
  DlsiteProductSummary,
  InvalidMetaFile,
  MetaDlsiteState,
  ResumeBody,
  ScanCandidateFolder,
  UpdatedWork,
  IdentityConflict,
  TagPrefix,
  WorkSummary,
  WorkspacePath,
} from "@mimimilli/shared";
import {
  SEED_PLAYLIST_SPECS,
  fixtureCoverColumnsForWork,
  fixtureCoverFromColumns,
  type FixtureCoverColumns,
  type FixtureWorkRecord,
  type SeedPlaylistSpec,
} from "./data.ts";
import type { SmartFolderRow } from "../../adapter/classification.ts";
import { insertFromTemplate } from "../../core/smartFolderPolicy.ts";
import { requireConfiguredRoot } from "../../core/rootFolder.ts";
import { createFixtureScenario, type FixtureRootReconfiguration } from "./scenarios.ts";

/** rjCodeをDLsite取得キャッシュのキーとして正規化する（realのnormalizeDlsiteProductCodeに合わせ大文字化）。 */
export function normalizeDlsiteCacheKey(rjCode: string): string {
  return rjCode.trim().toUpperCase();
}

const EMPTY_META_DLSITE_STATE: MetaDlsiteState = { rjCode: null, status: "none", appliedTags: [] };

/** 作品1件ぶんの安定したplaylist/track ID（呼び出しをまたいで同一IDを保つ） */
export interface PlaybackIds {
  playlists: Array<{ id: string; trackIds: string[] }>;
}

export function requireFixtureRoot(state: FixtureState): string {
  return requireConfiguredRoot(state.rootFolder);
}

/** fixtureのパーサー版。realと違い、取得ごとの記録も差し替えもない固定値 */
const FIXTURE_DLSITE_PARSER_VERSION = 1;

export interface FixtureDlsiteFetched {
  info: DlsiteWorkInfo;
  fetchedAt: number;
  expiresAt: number;
}

export interface FixtureDlsiteCover {
  body: Uint8Array;
  contentType: string;
  fetchedAt: number;
}

export interface FixtureState {
  rootFolder: string | null;
  lastScanTime: string | null;
  /** 永続化された再設定状態（realのuser DB app_settings.root_reconfiguration相当）。null は通常運用 */
  rootReconfiguration: FixtureRootReconfiguration | null;
  /** 直近の再設定が完了した時刻（realのapp_settings.root_reconfiguration_completed_at相当）。
   *  一度も完了していなければnull。 */
  rootReconfigurationCompletedAt: string | null;
  /** DLsite合成状態（dlsite）を含まない作品レコード。正本は works・dlsiteLinkages・
   *  dlsiteFetchFailures の3つで、合成済みのAPI向け状態はどこにも保存しない。 */
  works: FixtureWorkRecord[];
  /** rootの配下にないためcatalog相当の works から外した作品。物理ファイルの代わりで、user状態ごと保持する */
  detachedWorks: FixtureWorkRecord[];
  /** workIdごとのDLsite連携分類（meta linkage相当）。realのmimimilli.json.dlsiteに対応する。 */
  dlsiteLinkages: Map<string, MetaDlsiteState>;
  /** rjCodeごとのDLsite取得キャッシュ相当。realのDlsiteCacheに対応する。 */
  dlsiteFetchFailures: Map<string, DlsiteCacheResolution>;
  /** rjCodeごとの取得済み情報（realのDlsiteCacheのHTML snapshotと解析結果相当）。 */
  dlsiteFetched: Map<string, FixtureDlsiteFetched>;
  /** カバーキャッシュのキーごとのカバー画像（realのdlsite_cover_entries相当）。 */
  dlsiteCovers: Map<string, FixtureDlsiteCover>;
  /** 編集用カバー列（表示用 cover と独立。unmeasured を表現する） */
  coverColumns: Map<string, FixtureCoverColumns>;
  tagPrefixes: TagPrefix[];
  /** 位置の昇順。fixture は migration を通らないので、「すべて」と初回投入分を初期状態に持つ */
  smartFolders: SmartFolderRow[];
  /** 作品ごとのレジューム位置 */
  resumes: Map<string, ResumeBody>;
  playbackIds: Map<string, PlaybackIds>;
  playlistSpecs: Map<string, SeedPlaylistSpec[]>;
  /** scan() が insertedWorkIds として返す、未取り込みの新規作品ID（シナリオ "new-work" 用） */
  scanInsertedWorkIds: string[];
  /** scan() が updatedWorks として返す、変化のあった既存作品 */
  scanUpdatedWorks: UpdatedWork[];
  scanNewlyMissingWorkIds: string[];
  scanUnreadablePaths: WorkspacePath[];
  /** シナリオが指定するスキャン結果（新規・更新・行方不明・読めないパス・データ不整合）を返し終えたか。返すのは最初のスキャンだけ */
  scanScenarioDelivered: boolean;
  /** 永続化された候補除外パス */
  scanCandidateExclusions: string[];
  identityConflicts: IdentityConflict[];
  /** scan() が見つける候補。rootを変えても変わらない（fixtureには物理FSがない） */
  scanCandidatePool: ScanCandidateFolder[];
  invalidMetaFiles: InvalidMetaFile[];
  /** listSummaries でタグ等の不整合により除外した作品の報告 */
  dataIntegrityWarning: DataIntegrityWarning | undefined;
  dataIntegrityTitles: Record<string, string>;
  /** 編集 snapshot の CAS トークン（ファイルが無い fixture 用） */
  sourceRevisions: Map<string, string>;
  sourceRevisionSeq: number;
}

/** workIdのDLsite連携分類。未登録はnone。 */
export function dlsiteLinkageOf(state: FixtureState, workId: string): MetaDlsiteState {
  return state.dlsiteLinkages.get(workId) ?? EMPTY_META_DLSITE_STATE;
}

export function setDlsiteLinkage(
  state: FixtureState,
  workId: string,
  linkage: MetaDlsiteState,
): void {
  state.dlsiteLinkages.set(workId, linkage);
}

/** works からidが一致するレコードを取り除き、dlsiteLinkagesの対応エントリも消す。 */
export function removeWorks(state: FixtureState, ids: ReadonlySet<string>): void {
  if (ids.size === 0) return;
  state.works = state.works.filter((work) => !ids.has(work.id));
  for (const id of ids) state.dlsiteLinkages.delete(id);
}

/** 作品に紐づく状態（DLsite連携・プレイリスト定義・明示カバー列）を別idへ複製する。 */
export function copyWorkState(state: FixtureState, fromId: string, toId: string): void {
  setDlsiteLinkage(state, toId, dlsiteLinkageOf(state, fromId));
  const playlists = state.playlistSpecs.get(fromId);
  if (playlists) state.playlistSpecs.set(toId, playlists);
  const cover = state.coverColumns.get(fromId);
  if (cover) state.coverColumns.set(toId, cover);
}

/** rjCodeに対応するDLsite取得キャッシュの解決結果。realのDlsiteCache.resolveと同じくTTL切れはmiss扱い。 */
export function dlsiteFetchFailureFor(
  state: FixtureState,
  rjCode: string | null,
): DlsiteCacheResolution | null {
  if (rjCode === null || rjCode === "") return null;
  const entry = state.dlsiteFetchFailures.get(normalizeDlsiteCacheKey(rjCode));
  if (!entry || entry.kind === "miss") return null;
  return entry.expiresAt > Date.now() ? entry : null;
}

/** realのDlsiteCache.resolveHeadと同じ順（有効な失敗の記録→TTL内の取得済み→miss）で判断する。 */
export function fixtureDlsiteResolutionHead(
  state: FixtureState,
  rjCode: string,
): DlsiteCacheResolutionHead {
  const key = normalizeDlsiteCacheKey(rjCode);
  const failure = dlsiteFetchFailureFor(state, key);
  if (failure) return failure;
  const fetched = state.dlsiteFetched.get(key);
  if (!fetched) return { kind: "miss", reason: "not_cached" };
  if (fetched.expiresAt <= Date.now()) return { kind: "miss", reason: "ttl_expired" };
  return {
    kind: "html",
    outcome: "ok",
    fetchedAt: fetched.fetchedAt,
    expiresAt: fetched.expiresAt,
  };
}

/** realのreadUsableDlsiteと同じ判断。TTL内で取得済みのときだけ情報と版を返す */
export function fixtureUsableDlsite(
  state: FixtureState,
  rjCode: string,
): { info: DlsiteWorkInfo; revision: string } | null {
  if (fixtureDlsiteResolutionHead(state, rjCode).kind !== "html") return null;
  const fetched = state.dlsiteFetched.get(normalizeDlsiteCacheKey(rjCode));
  return fetched
    ? { info: fetched.info, revision: `${fetched.fetchedAt}:${FIXTURE_DLSITE_PARSER_VERSION}` }
    : null;
}

/** RJコードのDLsite取得状態の表示用の要約。スキャン候補と取得ジョブの終端が同じ規則で導く */
export function fixtureDlsiteSummary(
  state: FixtureState,
  rjCode: string | null,
): DlsiteProductSummary {
  if (!rjCode) return { state: "none" };
  const fetchState = dlsiteFetchStateOfResolution(fixtureDlsiteResolutionHead(state, rjCode));
  if (fetchState !== "fetched") return { state: fetchState };
  const fetched = state.dlsiteFetched.get(normalizeDlsiteCacheKey(rjCode));
  if (!fetched) return { state: "none" };
  const key = fetched.info.coverUrl ? fixtureDlsiteCoverKey(fetched.info.coverUrl) : null;
  const cover = key ? state.dlsiteCovers.get(key) : undefined;
  return {
    state: "fetched",
    title: fetched.info.title,
    cover: key && cover ? { key, version: cover.fetchedAt } : null,
  };
}

export function fixtureDlsiteCoverKey(coverUrl: string): string {
  return createHash("sha256").update(coverUrl).digest("hex");
}

/** 選んだカバーを適用できない理由。適用できる・カバーが無いときは null。画像として読めないものは contentType が image/ でないキャッシュ */
export function fixtureCoverSkipReason(
  state: FixtureState,
  coverUrl: string | null,
): DlsiteCoverSkipReason | null {
  if (coverUrl === null) return null;
  const cached = state.dlsiteCovers.get(fixtureDlsiteCoverKey(coverUrl));
  if (!cached) return "not_cached";
  return cached.contentType.startsWith("image/") ? null : "unreadable";
}

/** 適用できるカバーがキャッシュにあるか。DLsiteへは取りに行かない */
export function fixtureDlsiteCoverCached(state: FixtureState, coverUrl: string | null): boolean {
  return coverUrl !== null && fixtureCoverSkipReason(state, coverUrl) === null;
}

/** キャッシュ済みのカバーを作品のカバーにして、適用できなかった理由を返す。適用した・カバーが無いときは null */
export function applyFixtureCachedCover(
  state: FixtureState,
  work: FixtureWorkRecord,
  coverUrl: string | null,
): DlsiteCoverSkipReason | null {
  if (coverUrl === null) return null;
  const skipped = fixtureCoverSkipReason(state, coverUrl);
  if (skipped) return skipped;
  const columns: FixtureCoverColumns = {
    image: coverUrl,
    dimensions: work.cover?.dimensions ?? { width: 900, height: 900 },
  };
  state.coverColumns.set(work.id, columns);
  work.cover = fixtureCoverFromColumns(work, columns);
  return null;
}

/** 作品レコードとlinkage・取得キャッシュから、API向けの合成済みWorkSummaryを読み出し時に組み立てる。
 *  合成結果はどこにも保存しない。 */
export function composeWork(state: FixtureState, record: FixtureWorkRecord): WorkSummary {
  const { metaPath: _metaPath, ...summary } = record;
  const linkage = dlsiteLinkageOf(state, record.id);
  return {
    ...summary,
    dlsite: projectDlsiteState(linkage, dlsiteFetchFailureFor(state, linkage.rjCode)),
  };
}

export function composeWorks(state: FixtureState): WorkSummary[] {
  return state.works.map((record) => composeWork(state, record));
}

/** 契約テスト用の作品。fixture の作品レコードと同じく metaPath を持つ */
export type FixtureSeedWork = WorkSummary & { metaPath: string };

export interface FixtureAdapterOptions {
  /** データシナリオ（省略時 "default"）。不明なIDはエラー */
  scenario?: string;
  /** 再設定の構築段階1ステップあたりの待ち時間。再設定中の状態と進捗を観測できるよう既定では長めにする */
  rootRebuildStepMs?: number;
  /** DLsite取得1コードあたりの待ち時間。取得ジョブの進行を観測できるようにする（既定0）。 */
  dlsiteFetchDelayMs?: number;
  /** 契約テスト用に差し替える作品一覧。省略時はscenarioのseedを使う。dlsiteはrjCode/status/appliedTags
   *  （linkage相当）だけを取り出して使い、lastAttemptAt/error/errorKindは読まない。 */
  works?: FixtureSeedWork[];
  /** works差し替え時に、rjCodeごとのDLsite取得キャッシュ相当を明示的に与える（省略時は空）。 */
  dlsiteFetchFailures?: ReadonlyArray<{ rjCode: string; resolution: DlsiteCacheResolution }>;
  /** 作品IDごとのプレイリスト定義（meta の playlists に相当）。シードの定義に上書きで足す */
  playlistSpecs?: Readonly<Record<string, SeedPlaylistSpec[]>>;
  /** works差し替え時に、ID重複の診断を明示的に与える（省略時はシナリオ既定） */
  identityConflicts?: IdentityConflict[];
}

export function createInitialState(options: FixtureAdapterOptions): FixtureState {
  const now = new Date().toISOString();
  const scenario = createFixtureScenario(options.scenario, now);
  let works: FixtureWorkRecord[];
  let detachedWorks: FixtureWorkRecord[];
  let dlsiteLinkages: Map<string, MetaDlsiteState>;
  let dlsiteFetchFailures: Map<string, DlsiteCacheResolution>;
  if (options.works) {
    works = options.works.map(({ dlsite: _dlsite, ...record }) => record);
    detachedWorks = [];
    dlsiteLinkages = new Map(
      options.works.map((work) => [
        work.id,
        {
          rjCode: work.dlsite.rjCode,
          status: toDlsiteLinkageStatus(work.dlsite.status),
          appliedTags: work.dlsite.appliedTags,
        },
      ]),
    );
    dlsiteFetchFailures = new Map(
      (options.dlsiteFetchFailures ?? []).map((entry) => [
        normalizeDlsiteCacheKey(entry.rjCode),
        entry.resolution,
      ]),
    );
  } else {
    works = scenario.works;
    detachedWorks = scenario.detachedWorks;
    dlsiteLinkages = scenario.dlsiteLinkages;
    dlsiteFetchFailures = scenario.dlsiteFetchFailures;
  }

  const coverColumns = new Map<string, FixtureCoverColumns>();
  for (const work of [...works, ...detachedWorks]) {
    coverColumns.set(work.id, fixtureCoverColumnsForWork(work));
  }
  return {
    rootFolder: scenario.rootFolder,
    lastScanTime: scenario.lastScanTime,
    rootReconfiguration: scenario.rootReconfiguration,
    rootReconfigurationCompletedAt: null,
    works,
    detachedWorks,
    dlsiteLinkages,
    dlsiteFetchFailures,
    dlsiteFetched: new Map(),
    dlsiteCovers: new Map(),
    coverColumns,
    tagPrefixes: DEFAULT_TAG_PREFIXES.map((def) => ({ ...def })),
    smartFolders: SMART_FOLDER_TEMPLATES.filter((template) => template.seeded).map(
      (template, position) => ({ ...insertFromTemplate(template, now), position }),
    ),
    resumes: new Map(),
    playbackIds: new Map(),
    playlistSpecs: new Map(Object.entries({ ...SEED_PLAYLIST_SPECS, ...options.playlistSpecs })),
    scanInsertedWorkIds: scenario.scanInsertedWorkIds,
    scanUpdatedWorks: scenario.scanUpdatedWorks,
    scanNewlyMissingWorkIds: scenario.scanNewlyMissingWorkIds,
    scanUnreadablePaths: scenario.scanUnreadablePaths,
    scanScenarioDelivered: false,
    scanCandidateExclusions: [],
    identityConflicts: options.identityConflicts ?? scenario.identityConflicts,
    scanCandidatePool: scenario.scanCandidates,
    invalidMetaFiles: scenario.invalidMetaFiles,
    dataIntegrityWarning: scenario.dataIntegrityWarning,
    dataIntegrityTitles: scenario.dataIntegrityTitles ?? {},
    sourceRevisions: new Map([...works, ...detachedWorks].map((work) => [work.id, "fixture"])),
    sourceRevisionSeq: 0,
  };
}

export function coverColumnsOf(state: FixtureState, workId: string): FixtureCoverColumns {
  return state.coverColumns.get(workId) ?? { image: null, dimensions: null };
}

/** state を options で作り直した初期状態へ書き戻す（同一オブジェクト参照を保つ）。 */
export function resetState(state: FixtureState, options: FixtureAdapterOptions): void {
  Object.assign(state, createInitialState(options));
}
