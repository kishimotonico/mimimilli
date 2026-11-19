// DLsite 連携（POST /api/dlsite/:id/fetch | apply）の契約。
import { z } from "zod";
import {
  dedupeTags,
  normalizeTags,
  normalizedTagArraySchema,
  normalizedTagInputArraySchema,
  type NormalizedTag,
} from "./tagNormalize.ts";

export const dlsiteStatusSchema = z.enum(["none", "applied", "not_found", "error", "skipped"]);
export type DlsiteStatus = z.infer<typeof dlsiteStatusSchema>;

const DLSITE_HOSTNAME = "dlsite.com";

/** hostname が dlsite.com またはそのサブドメインのURLか。不正なURLは false */
export function isDlsiteUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return hostname === DLSITE_HOSTNAME || hostname.endsWith(`.${DLSITE_HOSTNAME}`);
}

export const dlsiteFetchErrorKindSchema = z.enum(["not_found", "parse_error", "offline", "error"]);
export type DlsiteFetchErrorKind = z.infer<typeof dlsiteFetchErrorKindSchema>;

export const dlsiteStateSchema = z.object({
  rjCode: z.string().nullable(),
  status: dlsiteStatusSchema,
  lastAttemptAt: z.iso.datetime({ offset: true }).nullable(),
  error: z.string().nullable(),
  errorKind: dlsiteFetchErrorKindSchema.nullable().default(null),
  appliedTags: normalizedTagArraySchema.default([]),
});
export type DlsiteState = z.infer<typeof dlsiteStateSchema>;

export function emptyDlsiteState(): DlsiteState {
  return {
    rjCode: null,
    status: "none",
    lastAttemptAt: null,
    error: null,
    errorKind: null,
    appliedTags: [],
  };
}

/** mimimilli.json正本が持つ連携分類。取得失敗（not_found/error）は正本の値になり得ない
 *  （ADR-0017 DLsite `status` の正本と投影）。 */
export const dlsiteLinkageStatusSchema = z.enum(["none", "applied", "skipped"]);
export type DlsiteLinkageStatus = z.infer<typeof dlsiteLinkageStatusSchema>;

/** mimimilli.json正本の `dlsite` フィールド専用の型。cacheと合成したAPI向けの `DlsiteState`
 *  とは別型にし、取得失敗・試行時刻などの一時状態を型として持てないようにする。 */
export const metaDlsiteStateSchema = z.object({
  rjCode: z.string().nullable(),
  status: dlsiteLinkageStatusSchema,
  appliedTags: normalizedTagArraySchema.default([]),
});
export type MetaDlsiteState = z.infer<typeof metaDlsiteStateSchema>;

export function emptyMetaDlsiteState(): MetaDlsiteState {
  return { rjCode: null, status: "none", appliedTags: [] };
}

/** 合成済みAPI状態から、正本が持てる連携分類だけを取り出す。取得失敗（not_found/error）は
 *  連携未確定として none に丸める。 */
export function toDlsiteLinkageStatus(status: DlsiteStatus): DlsiteLinkageStatus {
  return status === "applied" || status === "skipped" ? status : "none";
}

export type DlsiteHtmlOutcome = "ok" | "parse_error";
export type DlsiteFailureOutcome = "not_found" | "error";
export type DlsiteCacheMissReason = "not_cached" | "ttl_expired" | "snapshot_body_missing";

/** DLsite取得キャッシュの既定TTL。real（DlsiteCache）・fixture（seedのキャッシュ相当）で共有する。 */
export const DEFAULT_DLSITE_CACHE_TTLS_MS = {
  ok: 30 * 24 * 60 * 60 * 1000,
  parse_error: 60 * 60 * 1000,
  not_found: 3 * 24 * 60 * 60 * 1000,
  error: 60 * 60 * 1000,
} as const;
export type DlsiteCacheOutcome = keyof typeof DEFAULT_DLSITE_CACHE_TTLS_MS;

/** DLsite取得キャッシュの通常取得判断結果。fresh HTML / 有効な失敗記録 / miss のいずれか。
 *  real adapterのDlsiteCache（SQLite実装）とfixture adapterの両方が、この型を通じて
 *  projectDlsiteStateと合成する（real/fixtureで合成ロジックを重複実装しない）。 */
type DlsiteHtmlResolutionHead = {
  kind: "html";
  outcome: DlsiteHtmlOutcome;
  fetchedAt: number;
  expiresAt: number;
};
type DlsiteFailureResolution = {
  kind: "failure";
  outcome: DlsiteFailureOutcome;
  attemptedAt: number;
  expiresAt: number;
};
type DlsiteMissResolution = { kind: "miss"; reason: DlsiteCacheMissReason };

/** 本文を読まずに判断だけを返す解決結果。`DlsiteCacheResolution` から `html` を除いた形 */
export type DlsiteCacheResolutionHead =
  | DlsiteHtmlResolutionHead
  | DlsiteFailureResolution
  | DlsiteMissResolution;

export type DlsiteCacheResolution =
  | (DlsiteHtmlResolutionHead & { html: string })
  | DlsiteFailureResolution
  | DlsiteMissResolution;

function isoFromEpochMs(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

function dlsiteFailureMessage(rjCode: string, outcome: DlsiteFailureOutcome): string {
  return outcome === "not_found"
    ? `DLsite作品が見つかりません（${rjCode}）`
    : `DLsite取得に失敗しました（${rjCode}）`;
}

function dlsiteParseErrorMessage(rjCode: string): string {
  return `DLsiteのHTMLを解析できませんでした（${rjCode}）`;
}

function projectedDlsiteFetchFailure(
  base: Pick<DlsiteState, "rjCode" | "appliedTags">,
  status: "not_found" | "error",
  errorKind: DlsiteFetchErrorKind,
  message: string,
  lastAttemptAt: string,
): DlsiteState {
  return { ...base, status, lastAttemptAt, error: message, errorKind };
}

/**
 * mimimilli.json正本とDLsite取得キャッシュを合成し、catalog・APIが読む DlsiteState を組み立てる。
 * applied/skipped はmimimilli.jsonの連携分類が優先し、none のときだけキャッシュの取得結果を反映する。
 * real（DlsiteCacheの解決結果）・fixture（seedのキャッシュ相当）が共通で使う。
 */
export function projectDlsiteState(
  metaDlsite: MetaDlsiteState,
  cacheResolution: DlsiteCacheResolution | null,
): DlsiteState {
  const base = { rjCode: metaDlsite.rjCode, appliedTags: metaDlsite.appliedTags };
  if (metaDlsite.status === "applied" || metaDlsite.status === "skipped") {
    return {
      ...base,
      status: metaDlsite.status,
      lastAttemptAt: null,
      error: null,
      errorKind: null,
    };
  }
  if (!hasRjCode(metaDlsite) || !cacheResolution) {
    return { ...base, status: "none", lastAttemptAt: null, error: null, errorKind: null };
  }
  const rjCode = metaDlsite.rjCode;
  if (cacheResolution.kind === "failure") {
    const status = cacheResolution.outcome === "not_found" ? "not_found" : "error";
    const errorKind = cacheResolution.outcome === "not_found" ? "not_found" : "error";
    return projectedDlsiteFetchFailure(
      base,
      status,
      errorKind,
      dlsiteFailureMessage(rjCode, cacheResolution.outcome),
      isoFromEpochMs(cacheResolution.attemptedAt),
    );
  }
  if (cacheResolution.kind === "html" && cacheResolution.outcome === "parse_error") {
    return projectedDlsiteFetchFailure(
      base,
      "error",
      "parse_error",
      dlsiteParseErrorMessage(rjCode),
      isoFromEpochMs(cacheResolution.fetchedAt),
    );
  }
  return { ...base, status: "none", lastAttemptAt: null, error: null, errorKind: null };
}

/** RJコードが非空文字列として設定されているか。`null` と明示的な `""` は含まない。 */
export function hasRjCode<T extends Pick<DlsiteState, "rjCode">>(
  state: T,
): state is T & { rjCode: string } {
  return state.rjCode !== null && state.rjCode !== "";
}

/** RJコードが未検出のまま放置されている作品か（ユーザーが明示的にスキップした作品は除く）。
 *  `rjCode === ""` はユーザーが明示的にRJコードなしとした状態であり、未検出には含めない。
 *  作品詳細の警告で判定基準を一致させるための正典 */
export function isRjCodeMissing(state: Pick<DlsiteState, "rjCode" | "status">): boolean {
  return state.rjCode === null && state.status !== "skipped";
}

/** 候補文字列（フォルダー名 → タイトルの順）から RJ コードを検出する。VJ は検出しない。 */
export function detectRjCode(candidates: string[]): string | null {
  for (const candidate of candidates) {
    const match = candidate.match(/RJ\d{6,8}/i);
    if (match) return match[0].toUpperCase();
  }
  return null;
}

/** DLsiteのHTMLパースに失敗したまま残っている作品か */
export function isDlsiteParseFailed(state: DlsiteState): boolean {
  return state.status === "error" && state.errorKind === "parse_error";
}

/** DLsite取得が失敗したまま残っている（HTTP 404・通信エラー等。parse_error は除く）作品か */
export function isDlsiteFetchFailed(state: DlsiteState): boolean {
  return (
    state.status === "not_found" || (state.status === "error" && state.errorKind !== "parse_error")
  );
}

export const DLSITE_AGE_RATINGS = ["全年齢", "R15", "R18"] as const;
export const dlsiteAgeRatingSchema = z.enum(DLSITE_AGE_RATINGS);
export type DlsiteAgeRating = z.infer<typeof dlsiteAgeRatingSchema>;

/** DLsiteの年齢指定表示をratingタグの値へ正規化する。未知表記は捨てる。 */
export function normalizeDlsiteAgeRating(raw: string): DlsiteAgeRating | null {
  const value = raw.trim();
  if (value === "全年齢" || value === "全年齢向け") return "全年齢";
  if (/^R-?15$/i.test(value)) return "R15";
  if (/^R-?18$/i.test(value) || value === "18禁") return "R18";
  return null;
}

/** 選んだDLsiteカバーを適用しなかった理由。カバーを選んでいない・DLsiteにカバーが無いときは理由を持たない */
export const dlsiteCoverSkipReasonSchema = z.enum(["outside_root", "unreadable", "not_cached"]);
export type DlsiteCoverSkipReason = z.infer<typeof dlsiteCoverSkipReasonSchema>;

/** RJ/VJコードの形式。DLsiteキャッシュが受け付ける形式（`^(RJ|VJ)\d{6,8}$`）と一致させる。 */
export const RJ_CODE_PATTERN = /^(RJ|VJ)\d{6,8}$/i;

/** 非空のRJ/VJコード1件の形式検証・正規化（大文字化）の正典。
 *  空文字（RJコードなしの明示）・未指定は呼び出し側で個別に扱う。 */
export const rjCodeFormatSchema = z
  .string()
  .trim()
  .regex(RJ_CODE_PATTERN, "RJ/VJコードはRJまたはVJに続く6〜8桁で入力してください")
  .transform((value) => value.toUpperCase());

export const dlsiteWorkInfoSchema = z.object({
  rjCode: rjCodeFormatSchema,
  title: z.string(),
  circle: z.string().nullable(),
  cvs: z.array(z.string()),
  genreTags: z.array(z.string()),
  ageRating: dlsiteAgeRatingSchema.nullable(),
  coverUrl: z.string().nullable(),
  url: z.string(),
});
export type DlsiteWorkInfo = z.infer<typeof dlsiteWorkInfoSchema>;

export const DLSITE_COVER_KEY_PATTERN = /^[0-9a-f]{64}$/;

/** DLsiteキャッシュに保存済みのカバー。画面はkeyとversionから配信URLを組み立て、DLsiteのURLは読まない */
export const dlsiteCachedCoverSchema = z.object({
  key: z.string().regex(DLSITE_COVER_KEY_PATTERN),
  /** カバーキャッシュのfetched_at。変わればURLが変わる */
  version: z.number().int().positive(),
});
export type DlsiteCachedCover = z.infer<typeof dlsiteCachedCoverSchema>;

/** POST /dlsite/fetch-by-code の成功応答 */
export const dlsiteFetchByCodeResponseSchema = z.object({
  info: dlsiteWorkInfoSchema,
  cachedCover: dlsiteCachedCoverSchema.nullable(),
});
export type DlsiteFetchByCodeResponse = z.infer<typeof dlsiteFetchByCodeResponseSchema>;

/** DLsite取得情報→タグの変換テーブル。cardinalityは `DlsiteWorkInfo` の型が表す事実
 *  （circle・ageRatingは単一nullable、cvs・genreTagsは配列）をそのまま写したもので、
 *  prefix名で分岐する判定はここに一度だけ書く。mergeロジック側はこのテーブルから
 *  cardinalityを導出し、prefix名を直接分岐に使わない（ADR-0005） */
const DLSITE_TAG_FIELDS: readonly {
  prefix: string;
  cardinality: "single" | "multi";
  values: (info: DlsiteWorkInfo) => readonly string[];
}[] = [
  {
    prefix: "サークル",
    cardinality: "single",
    values: (info) => (info.circle ? [info.circle] : []),
  },
  { prefix: "cv", cardinality: "multi", values: (info) => info.cvs },
  { prefix: "genre", cardinality: "multi", values: (info) => info.genreTags },
  {
    prefix: "rating",
    cardinality: "single",
    values: (info) => (info.ageRating ? [info.ageRating] : []),
  },
];

/** 取得情報を作品タグへ変換する（要件 v4 §4.4）。結果は正規形。 */
export function dlsiteInfoTags(info: DlsiteWorkInfo): NormalizedTag[] {
  const tags = DLSITE_TAG_FIELDS.flatMap((field) =>
    field.values(info).map((value) => `${field.prefix}/${value}`),
  );
  return dedupeTags(normalizeTags(tags));
}

const SINGLE_VALUE_DLSITE_PREFIXES = new Set(
  DLSITE_TAG_FIELDS.filter((field) => field.cardinality === "single").map((field) => field.prefix),
);

function tagPrefixOf(tag: string): string {
  return tag.split("/", 1)[0] ?? "";
}

/** タイトルを反映するときに使うDLsiteのタイトル。反映しない・DLsite側が空のときはundefined */
export function dlsiteTitleToApply(info: DlsiteWorkInfo, applyTitle: boolean): string | undefined {
  return applyTitle && info.title !== "" ? info.title : undefined;
}

/** 単体適用（replace）: ユーザーが明示的に選んだタグ（applyTags）を既存タグへ反映する。
 *  単一値prefixは既存の同prefixタグを置き換え、2値共存を作らない。複数値prefixは加算する。
 *  既存タグと同じ値を選び直しただけの行は元の並び順のまま残す（不要な並べ替えをしない） */
export function mergeAppliedDlsiteTags(
  existing: readonly NormalizedTag[],
  applyTags: readonly NormalizedTag[],
): NormalizedTag[] {
  const replacingPrefixes = new Set(
    applyTags.map(tagPrefixOf).filter((prefix) => SINGLE_VALUE_DLSITE_PREFIXES.has(prefix)),
  );
  const applyTagSet = new Set(applyTags);
  const kept = existing.filter(
    (tag) => !replacingPrefixes.has(tagPrefixOf(tag)) || applyTagSet.has(tag),
  );
  const keptSet = new Set(kept);
  const added = applyTags.filter((tag) => !keptSet.has(tag));
  return dedupeTags([...kept, ...added]);
}

/** 作品詳細の適用で、作品側の現在値 */
export interface DlsiteWorkCurrent {
  title: string;
  tags: readonly NormalizedTag[];
  urls: readonly { label: string; url: string }[];
  hasCover: boolean;
}

export type DlsiteUnavailableReason = "no_title" | "no_url" | "no_cover" | "cover_not_cached";

/** 1項目の差分。fill は作品側が未設定、replace は既存の値を置き換える */
export type DlsiteValueChange =
  | { kind: "unchanged"; current: string }
  | { kind: "fill"; next: string }
  | { kind: "replace"; current: string; next: string }
  | { kind: "unavailable"; current: string | null; reason: DlsiteUnavailableReason };

export type DlsiteCoverChange =
  | { kind: "fill" }
  | { kind: "replace" }
  | { kind: "unavailable"; reason: "no_cover" | "cover_not_cached" };

/** 作品に無いDLsiteのタグ1つ。replaces は反映すると外れる既存タグ（単一値prefixの置き換え） */
export interface DlsiteTagChange {
  tag: NormalizedTag;
  replaces: NormalizedTag[];
}

export interface DlsiteWorkDiff {
  title: DlsiteValueChange;
  url: DlsiteValueChange;
  cover: DlsiteCoverChange;
  /** 作品に無いDLsiteのタグ（dlsiteInfoTags の順） */
  tags: DlsiteTagChange[];
  /** すでに作品に付いているDLsiteのタグ */
  presentTags: NormalizedTag[];
  hasChanges: boolean;
}

function currentDlsiteUrl(urls: readonly { url: string }[]): string | null {
  return urls.find((entry) => isDlsiteUrl(entry.url))?.url ?? null;
}

/** 作品詳細の適用の差分。クライアントの確認ダイアログとサーバーの適用が同じ関数を使う */
export function computeDlsiteWorkDiff(
  current: DlsiteWorkCurrent,
  info: DlsiteWorkInfo,
  availability: { coverCached: boolean },
): DlsiteWorkDiff {
  const nextTitle = dlsiteTitleToApply(info, true);
  const title: DlsiteValueChange =
    nextTitle === undefined
      ? { kind: "unavailable", current: current.title, reason: "no_title" }
      : nextTitle === current.title
        ? { kind: "unchanged", current: current.title }
        : { kind: "replace", current: current.title, next: nextTitle };

  const currentUrl = currentDlsiteUrl(current.urls);
  const url: DlsiteValueChange =
    info.url === ""
      ? { kind: "unavailable", current: currentUrl, reason: "no_url" }
      : currentUrl === null
        ? { kind: "fill", next: info.url }
        : currentUrl === info.url
          ? { kind: "unchanged", current: currentUrl }
          : { kind: "replace", current: currentUrl, next: info.url };

  const cover: DlsiteCoverChange =
    info.coverUrl === null
      ? { kind: "unavailable", reason: "no_cover" }
      : !availability.coverCached
        ? { kind: "unavailable", reason: "cover_not_cached" }
        : current.hasCover
          ? { kind: "replace" }
          : { kind: "fill" };

  const existing = new Set<string>(current.tags);
  const tags: DlsiteTagChange[] = [];
  const presentTags: NormalizedTag[] = [];
  for (const tag of dlsiteInfoTags(info)) {
    if (existing.has(tag)) {
      presentTags.push(tag);
      continue;
    }
    const prefix = tagPrefixOf(tag);
    tags.push({
      tag,
      replaces: SINGLE_VALUE_DLSITE_PREFIXES.has(prefix)
        ? current.tags.filter((currentTag) => tagPrefixOf(currentTag) === prefix)
        : [],
    });
  }

  return {
    title,
    url,
    cover,
    tags,
    presentTags,
    hasChanges:
      title.kind === "replace" ||
      url.kind === "fill" ||
      url.kind === "replace" ||
      cover.kind === "fill" ||
      cover.kind === "replace" ||
      tags.length > 0,
  };
}

export const dlsiteApplySelectionSchema = z.object({
  title: z.boolean(),
  cover: z.boolean(),
  url: z.boolean(),
  tags: normalizedTagInputArraySchema,
});
export type DlsiteApplySelectionInput = z.input<typeof dlsiteApplySelectionSchema>;
export type DlsiteApplySelection = z.output<typeof dlsiteApplySelectionSchema>;

/** 確認ダイアログの既定の選択。未設定の項目だけを選び、既存の値を置き換えるものは選ばない */
export function defaultDlsiteApplySelection(diff: DlsiteWorkDiff): DlsiteApplySelectionInput {
  return {
    title: false,
    cover: diff.cover.kind === "fill",
    url: diff.url.kind === "fill",
    tags: diff.tags.filter((change) => change.replaces.length === 0).map((change) => change.tag),
  };
}

export interface DlsiteApplyPlan {
  title?: string;
  tags?: NormalizedTag[];
  urls?: { label: string; url: string }[];
  /** true のときだけ呼び出し側が一時ファイル化したカバーを確定する */
  applyCover: boolean;
  dlsite: MetaDlsiteState;
}

/** 作品詳細の適用でメタに書く内容を決める。選ばれていて差分のある項目だけを書く。real/fixture が共有する */
export function planDlsiteApply(
  current: DlsiteWorkCurrent & { dlsite: MetaDlsiteState },
  info: DlsiteWorkInfo,
  selection: DlsiteApplySelection,
  availability: { coverCached: boolean },
): DlsiteApplyPlan {
  const diff = computeDlsiteWorkDiff(current, info, availability);
  const writes = (change: DlsiteValueChange) => change.kind === "fill" || change.kind === "replace";
  const selectable = new Set<string>(diff.tags.map((change) => change.tag));
  const applyTags = selection.tags.filter((tag) => selectable.has(tag));
  return {
    title: selection.title && diff.title.kind === "replace" ? diff.title.next : undefined,
    tags: applyTags.length > 0 ? mergeAppliedDlsiteTags(current.tags, applyTags) : undefined,
    urls:
      selection.url && writes(diff.url)
        ? [
            ...current.urls.filter((entry) => !isDlsiteUrl(entry.url)),
            { label: "DLsite", url: info.url },
          ]
        : undefined,
    applyCover: selection.cover && (diff.cover.kind === "fill" || diff.cover.kind === "replace"),
    dlsite: {
      rjCode: info.rjCode,
      status: "applied",
      appliedTags: dedupeTags([...current.dlsite.appliedTags, ...applyTags]),
    },
  };
}

export const dlsiteFetchResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), info: dlsiteWorkInfoSchema }),
  z.object({
    ok: z.literal(false),
    kind: dlsiteFetchErrorKindSchema,
    message: z.string(),
  }),
]);
export type DlsiteFetchResult = z.infer<typeof dlsiteFetchResultSchema>;

/** 作品ごとの取得結果確認に使う。sourceRevision・infoRevision は適用時のCASトークン。 */
export const dlsitePreviewSchema = z.object({
  info: dlsiteWorkInfoSchema,
  /** 確認したDLsite情報の版。解析結果の取得時刻とパーサー版の組を表す不透明な文字列 */
  infoRevision: z.string().min(1),
  cachedCover: dlsiteCachedCoverSchema.nullable(),
  sourceRevision: z.string().min(1),
});
export type DlsitePreview = z.infer<typeof dlsitePreviewSchema>;

/** 作品単位の取得（dlsiteFetch）の結果。成功時はキャッシュの版とカバーの有無を持つ */
export type DlsiteWorkFetchResult =
  | { ok: true; info: DlsiteWorkInfo; infoRevision: string; cachedCover: DlsiteCachedCover | null }
  | Extract<DlsiteFetchResult, { ok: false }>;

export const dlsiteApplyBodySchema = z.object({
  sourceRevision: z.string().min(1),
  infoRevision: z.string().min(1),
  apply: dlsiteApplySelectionSchema,
});
export type DlsiteApplyBodyInput = z.input<typeof dlsiteApplyBodySchema>;
export type DlsiteApplyBody = z.output<typeof dlsiteApplyBodySchema>;

/** 追加で反映するDLsiteの項目。DLsite情報が使えない作品では無視される */
export const dlsiteRegistrationApplySchema = z.object({
  title: z.boolean(),
  cover: z.boolean(),
  tags: z.boolean(),
  url: z.boolean(),
});
export type DlsiteRegistrationApply = z.infer<typeof dlsiteRegistrationApplySchema>;

export interface DlsiteRegistrationPlan {
  title: string;
  tags: NormalizedTag[];
  dlsiteUrl: { label: "DLsite"; url: string } | null;
  /** 反映するときだけ。nullならカバーを触らない */
  coverUrl: string | null;
  dlsite: MetaDlsiteState;
}

/**
 * 作品の追加で、入力とDLsite情報からメタに書く内容を決める。real/fixture と、候補の追加・Filesの作品登録が共有する。
 * infoは「TTL内でokのキャッシュ」を解析できたときだけ渡す。appliedTagsはDLsiteのタグのうち最終的なタグに含まれるもの。
 */
export function planDlsiteRegistration(input: {
  rjCode: string | null;
  info: DlsiteWorkInfo | null;
  title: string;
  tags: readonly NormalizedTag[];
  apply: DlsiteRegistrationApply;
}): DlsiteRegistrationPlan {
  const { rjCode, info, apply } = input;
  if (info === null) {
    return {
      title: input.title,
      tags: [...input.tags],
      dlsiteUrl: null,
      coverUrl: null,
      dlsite: { rjCode, status: "none", appliedTags: [] },
    };
  }
  const infoTags = dlsiteInfoTags(info);
  const tags = apply.tags ? dedupeTags([...input.tags, ...infoTags]) : [...input.tags];
  const finalTags = new Set<string>(tags);
  return {
    title: dlsiteTitleToApply(info, apply.title) ?? input.title,
    tags,
    dlsiteUrl: apply.url && info.url !== "" ? { label: "DLsite", url: info.url } : null,
    coverUrl: apply.cover ? info.coverUrl : null,
    dlsite: {
      rjCode: info.rjCode,
      status: "applied",
      appliedTags: infoTags.filter((tag) => finalTags.has(tag)),
    },
  };
}

/** 作品詳細で入力できるRJコード。空文字はコードなしの明示 */
const dlsiteRjCodeInputSchema = z.union([z.literal(""), rjCodeFormatSchema]);

/** PATCH /api/dlsite/:id。状態変更は正本 CAS のため sourceRevision 必須。 */
export const dlsiteStateUpdateBodySchema = z
  .object({
    sourceRevision: z.string().min(1),
    rjCode: dlsiteRjCodeInputSchema.optional(),
    skipped: z.boolean().optional(),
  })
  .refine((patch) => patch.rjCode !== undefined || patch.skipped !== undefined);
export type DlsiteStateUpdateBody = z.infer<typeof dlsiteStateUpdateBodySchema>;
export type DlsiteStatePatch = Omit<DlsiteStateUpdateBody, "sourceRevision">;

/** updateDlsiteState の状態遷移（real/fixture 共通）。正本の連携分類（rjCode/status/
 *  appliedTags）だけを対象にする。RJコードが変わったときだけ旧コード由来の適用済みタグを捨てて
 *  未取得に戻す。skipped 指定時は status を上書きする（rjCode 変更より後に適用）。 */
export function applyDlsiteStatePatch(
  current: MetaDlsiteState,
  patch: DlsiteStatePatch,
): MetaDlsiteState {
  let next: MetaDlsiteState = { ...current };

  if (patch.rjCode !== undefined) {
    next.rjCode = patch.rjCode;
    if (patch.rjCode !== current.rjCode) {
      next = { ...next, status: "none", appliedTags: [] };
    }
  }

  if (patch.skipped !== undefined) {
    next = { ...next, status: patch.skipped ? "skipped" : "none" };
  }

  return next;
}

/** POST /api/dlsite/jobs の1リクエストに含められるproduct codeの上限。超える分はクライアントが分割して送る */
export const DLSITE_JOB_MAX_PRODUCT_CODES = 1000;

/** 取得ジョブのキー（product code）の正規化。表記ゆれを大文字に揃える */
export function canonicalDlsiteProductCode(code: string): string {
  return code.trim().toUpperCase();
}

/** 1コードあたりの取得時間の目安。「N件・約M分」の表示に使う（測った速度は使わない） */
export const DLSITE_FETCH_ESTIMATE_MS_PER_CODE = 2000;

export const dlsiteJobOriginSchema = z.enum(["bulk", "single"]);
export type DlsiteJobOrigin = z.infer<typeof dlsiteJobOriginSchema>;

export const dlsiteJobCodeStateSchema = z.enum([
  "queued",
  "fetching",
  "fetched",
  "not_found",
  "failed",
]);
export type DlsiteJobCodeState = z.infer<typeof dlsiteJobCodeStateSchema>;

/** POST /api/dlsite/jobs のボディ。singleは失敗の記録を無視して取り直す（force） */
export const dlsiteJobStartBodySchema = z.discriminatedUnion("origin", [
  z.object({
    origin: z.literal("bulk"),
    productCodes: z.array(rjCodeFormatSchema).min(1).max(DLSITE_JOB_MAX_PRODUCT_CODES),
  }),
  z.object({ origin: z.literal("single"), productCode: rjCodeFormatSchema }),
]);
export type DlsiteJobStartBody = z.infer<typeof dlsiteJobStartBodySchema>;

const dlsiteFetchedSummarySchema = z.object({
  state: z.literal("fetched"),
  title: z.string(),
  /** null はカバーの先取りに失敗してキャッシュに無い */
  cover: dlsiteCachedCoverSchema.nullable(),
});
const dlsiteNotFoundSummarySchema = z.object({ state: z.literal("not_found") });
const dlsiteFailedSummarySchema = z.object({ state: z.literal("failed") });

/** 取得結果の表示用の要約。スキャン候補の表示と取得ジョブの終端が同じ形を運ぶ */
export const dlsiteProductSummarySchema = z.discriminatedUnion("state", [
  /** 未取得（キャッシュに無い・TTL切れ・RJコードなし） */
  z.object({ state: z.literal("none") }),
  dlsiteFetchedSummarySchema,
  dlsiteNotFoundSummarySchema,
  dlsiteFailedSummarySchema,
]);
export type DlsiteProductSummary = z.infer<typeof dlsiteProductSummarySchema>;

/** 取得ジョブの終端が運ぶ結果。none は取得の結果として現れない */
export type DlsiteTerminalProductSummary = Exclude<DlsiteProductSummary, { state: "none" }>;

/**
 * サーバー状態の新旧を決める単調増加の値。プロセス全体で1つ数え、クライアントに見える変化のたびに進む。
 * イベント履歴を再生するための連番ではない
 */
const dlsiteRevisionSchema = z.number().int().nonnegative();

const dlsiteJobCodeBase = {
  productCode: z.string(),
  origin: dlsiteJobOriginSchema,
  /** このコードが最後に変化した時点の revision */
  revision: dlsiteRevisionSchema,
};

/** コードの現在状態。終端（fetched / not_found / failed）は取得の結果 dlsite を運ぶ */
export const dlsiteJobCodeSchema = z.discriminatedUnion("state", [
  z.object({ ...dlsiteJobCodeBase, state: z.literal("queued") }),
  z.object({ ...dlsiteJobCodeBase, state: z.literal("fetching") }),
  z.object({
    ...dlsiteJobCodeBase,
    state: z.literal("fetched"),
    dlsite: dlsiteFetchedSummarySchema,
  }),
  z.object({
    ...dlsiteJobCodeBase,
    state: z.literal("not_found"),
    dlsite: dlsiteNotFoundSummarySchema,
  }),
  z.object({ ...dlsiteJobCodeBase, state: z.literal("failed"), dlsite: dlsiteFailedSummarySchema }),
]);
export type DlsiteJobCode = z.infer<typeof dlsiteJobCodeSchema>;

/** 起点がまとめてのコードだけを数える。processedは終端状態のコード数 */
export const dlsiteJobBulkProgressSchema = z.object({
  processed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type DlsiteJobBulkProgress = z.infer<typeof dlsiteJobBulkProgressSchema>;

export const dlsiteJobSnapshotSchema = z.object({
  jobId: z.string(),
  status: z.enum(["running", "finished"]),
  codes: z.array(dlsiteJobCodeSchema),
  bulk: dlsiteJobBulkProgressSchema,
});
export type DlsiteJobSnapshot = z.infer<typeof dlsiteJobSnapshotSchema>;

/**
 * POST /api/dlsite/jobs（受け付けた直後の状態）と GET /api/dlsite/jobs/current のレスポンス。
 * finishedのジョブは次のジョブ開始まで残る。revision はジョブ全体の新旧を決め、job が null でも付く
 */
export const dlsiteJobStateSchema = z.object({
  revision: dlsiteRevisionSchema,
  job: dlsiteJobSnapshotSchema.nullable(),
});
export type DlsiteJobState = z.infer<typeof dlsiteJobStateSchema>;

/** DELETE /api/dlsite/jobs/:jobId/bulk のレスポンス */
export const dlsiteJobCancelBulkResponseSchema = z.object({
  removed: z.number().int().nonnegative(),
});
export type DlsiteJobCancelBulkResponse = z.infer<typeof dlsiteJobCancelBulkResponseSchema>;

const dlsiteJobCodeEventBase = {
  type: z.literal("code"),
  jobId: z.string(),
  bulk: dlsiteJobBulkProgressSchema,
  ...dlsiteJobCodeBase,
};

const dlsiteJobCodeEventSchema = z.discriminatedUnion("state", [
  z.object({ ...dlsiteJobCodeEventBase, state: z.literal("queued") }),
  z.object({ ...dlsiteJobCodeEventBase, state: z.literal("fetching") }),
  z.object({
    ...dlsiteJobCodeEventBase,
    state: z.literal("fetched"),
    dlsite: dlsiteFetchedSummarySchema,
  }),
  z.object({
    ...dlsiteJobCodeEventBase,
    state: z.literal("not_found"),
    dlsite: dlsiteNotFoundSummarySchema,
  }),
  z.object({
    ...dlsiteJobCodeEventBase,
    state: z.literal("failed"),
    dlsite: dlsiteFailedSummarySchema,
  }),
]);

/** 進捗SSE。codeは当該コードの現在状態（差分ではない） */
export const dlsiteJobEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("snapshot"),
    revision: dlsiteRevisionSchema,
    job: dlsiteJobSnapshotSchema.nullable(),
  }),
  dlsiteJobCodeEventSchema,
  z.object({
    type: z.literal("removed"),
    revision: dlsiteRevisionSchema,
    jobId: z.string(),
    productCodes: z.array(z.string()),
    bulk: dlsiteJobBulkProgressSchema,
  }),
  z.object({
    type: z.literal("finished"),
    revision: dlsiteRevisionSchema,
    jobId: z.string(),
    reason: z.enum(["complete", "aborted"]),
  }),
]);
export type DlsiteJobEvent = z.infer<typeof dlsiteJobEventSchema>;

export type DlsiteFetchState = "none" | "fetched" | "not_found" | "failed";

/** キャッシュの解決結果から導く取得状態。ジョブの終端状態はこれと一致する */
export function dlsiteFetchStateOfResolution(
  resolution: DlsiteCacheResolutionHead,
): DlsiteFetchState {
  if (resolution.kind === "miss") return "none";
  if (resolution.kind === "failure")
    return resolution.outcome === "not_found" ? "not_found" : "failed";
  return resolution.outcome === "ok" ? "fetched" : "failed";
}
