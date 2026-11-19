// DLsite 連携（POST /api/dlsite/:id/fetch | apply）の契約。
import { z } from "zod";
import {
  dedupeTags,
  normalizeTags,
  normalizedTagArraySchema,
  normalizedTagInputArraySchema,
  type NormalizedTag,
} from "./tagNormalize.ts";
import type { WorkSummary } from "./work.ts";

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

export function hasDlsiteUrl(urls: readonly { url: string }[]): boolean {
  return urls.some((entry) => isDlsiteUrl(entry.url));
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
 *  スキャン完了通知・一覧の両方で判定基準を一致させるための正典 */
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

/** 外部連携列（スキャン結果タブ）の「失敗」表示に使う正典。理由を問わず取得できなかった
 *  状態（not_found・error。parse_errorも含む）をまとめて「失敗」とする。`isDlsiteFetchFailed`
 *  は通知バッジ向けにparse_errorを除外して数えるが、この列は理由を出し分けないため区別しない。 */
export function isDlsiteLinkFailed(state: Pick<DlsiteState, "status">): boolean {
  return state.status === "not_found" || state.status === "error";
}

export type DlsiteLinkDisplayStatus = "linked" | "pending" | "failed" | "none";

/** 外部連携列（スキャン結果タブ）の4状態（連携済み・取得待ち・失敗・—）を判定する正典。
 *  rjCodeの有無は`hasRjCode`、失敗は`isDlsiteLinkFailed`をそのまま使う。 */
export function dlsiteLinkDisplayStatus(
  state: Pick<DlsiteState, "rjCode" | "status">,
): DlsiteLinkDisplayStatus {
  if (!hasRjCode(state)) return "none";
  if (state.status === "applied") return "linked";
  if (isDlsiteLinkFailed(state)) return "failed";
  return "pending";
}

/** パース失敗が構造変更レベルで増えたかのしきい値（件数・割合の下限） */
export const DLSITE_PARSE_ERROR_ALERT_MIN_COUNT = 3;
export const DLSITE_PARSE_ERROR_ALERT_MIN_RATIO = 0.2;

/** 分母はパース成功 + パース失敗（HTTPエラー・not_found はパース未到達のため含めない） */
export function evaluateParseErrorAlert(
  parseErrorCount: number,
  parseSuccessCount: number,
): boolean {
  const attempted = parseErrorCount + parseSuccessCount;
  return (
    parseErrorCount >= DLSITE_PARSE_ERROR_ALERT_MIN_COUNT &&
    attempted > 0 &&
    parseErrorCount / attempted >= DLSITE_PARSE_ERROR_ALERT_MIN_RATIO
  );
}

/** DLsite未連携（RJコードは判明しているが取得を一度も試みていない）作品か。
 *  通知の未連携件数の判定基準。取得失敗（error）は isDlsiteFetchFailed 側で別掲する。 */
export function isDlsiteUnlinked(state: DlsiteState): boolean {
  return hasRjCode(state) && state.status === "none";
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

function hasTagWithPrefix(tags: readonly NormalizedTag[], prefix: string): boolean {
  return tags.some((tag) => tagPrefixOf(tag) === prefix);
}

/** 一括適用（fill-unset）: 単一値prefix（サークル・rating）は、既存に同prefixのタグが
 *  1つでもあれば追加しない。複数値prefix（cv・genre）は完全一致のみ除外して加算する。
 *  返り値は既存タグへ新たに追加する分だけ（既存値は上書きしない） */
export function fillUnsetDlsiteTags(
  existing: readonly NormalizedTag[],
  info: DlsiteWorkInfo,
): NormalizedTag[] {
  return dlsiteInfoTags(info).filter((tag) => {
    if (existing.includes(tag)) return false;
    const prefix = tagPrefixOf(tag);
    if (SINGLE_VALUE_DLSITE_PREFIXES.has(prefix)) return !hasTagWithPrefix(existing, prefix);
    return true;
  });
}

/** dlsiteApplyMissing / dlsiteApplyMissingPreview が real/fixture 両 adapter で共有する差分計算。
 *  既存値は上書きしない */
export function computeMissingDiff(
  work: Pick<WorkSummary, "tags" | "cover" | "urls">,
  info: DlsiteWorkInfo,
): { newTags: NormalizedTag[]; applyCover: boolean; applyUrl: boolean } {
  const newTags = fillUnsetDlsiteTags(work.tags, info);
  const applyCover = !work.cover && info.coverUrl !== null;
  const applyUrl = !hasDlsiteUrl(work.urls);
  return { newTags, applyCover, applyUrl };
}

/** dlsiteApply（単体適用）のパッチ。cover は非同期I/Oを伴うため呼び出し側が別途解決し、
 *  パッチには含めない。title/tags/urls は未変更なら undefined。 */
export interface DlsiteApplyPatch {
  title?: string;
  tags?: NormalizedTag[];
  urls?: { label: string; url: string }[];
  dlsite: MetaDlsiteState;
}

interface DlsiteApplyCurrent {
  tags: readonly NormalizedTag[];
  urls: readonly { label: string; url: string }[];
  dlsite: MetaDlsiteState;
}

/** 単体適用・欠落適用が共有する tags/urls/linkage の組み立て。linkage は status: "applied" にする */
function buildDlsiteTagsUrlsPatch(
  current: DlsiteApplyCurrent,
  info: DlsiteWorkInfo,
  applyTags: readonly NormalizedTag[],
  applyUrl: boolean,
): Omit<DlsiteApplyPatch, "title"> {
  return {
    tags: applyTags.length > 0 ? mergeAppliedDlsiteTags(current.tags, applyTags) : undefined,
    urls:
      applyUrl && info.url
        ? [
            ...current.urls.filter((entry) => !isDlsiteUrl(entry.url)),
            { label: "DLsite", url: info.url },
          ]
        : undefined,
    dlsite: {
      rjCode: info.rjCode,
      status: "applied",
      appliedTags: dedupeTags([...current.dlsite.appliedTags, ...applyTags]),
    },
  };
}

/** タイトルを反映するときに使うDLsiteのタイトル。反映しない・DLsite側が空のときはundefined */
export function dlsiteTitleToApply(info: DlsiteWorkInfo, applyTitle: boolean): string | undefined {
  return applyTitle && info.title !== "" ? info.title : undefined;
}

/** dlsiteApply（単体適用）のtitle/tags/urlsパッチを組み立てる。real/fixture 両adapterが共有する。 */
export function buildDlsiteApplyPatch(
  current: DlsiteApplyCurrent & { title: string },
  body: DlsiteApplyBody,
): DlsiteApplyPatch {
  return {
    title: dlsiteTitleToApply(body.info, body.applyTitle),
    ...buildDlsiteTagsUrlsPatch(current, body.info, body.applyTags, body.applyUrl),
  };
}

/** dlsiteApplyMissing（未設定項目まとめ適用）のtags/urls/linkageパッチを組み立てる。
 *  real/fixture 両adapterが共有する。差分が無ければnull（何も書かない）。
 *  title/coverはこの関数の対象外。 */
export function buildDlsiteMissingApplyPatch(
  current: DlsiteApplyCurrent,
  info: DlsiteWorkInfo,
  diff: { newTags: readonly NormalizedTag[]; applyCover: boolean; applyUrl: boolean },
): Omit<DlsiteApplyPatch, "title"> | null {
  if (diff.newTags.length === 0 && !diff.applyCover && !diff.applyUrl) return null;
  return buildDlsiteTagsUrlsPatch(current, info, diff.newTags, diff.applyUrl);
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

/** 作品ごとの取得結果確認に使う。sourceRevision は適用時のCASトークン。 */
export const dlsitePreviewSchema = z.object({
  info: dlsiteWorkInfoSchema,
  sourceRevision: z.string().min(1),
});
export type DlsitePreview = z.infer<typeof dlsitePreviewSchema>;

export const dlsiteFetchResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), info: dlsiteWorkInfoSchema }),
  z.object({
    ok: z.literal(false),
    kind: dlsiteFetchErrorKindSchema,
    message: z.string(),
  }),
]);
export type DlsiteFetchResult = z.infer<typeof dlsiteFetchResultSchema>;

export const dlsiteApplyBodySchema = z.object({
  info: dlsiteWorkInfoSchema,
  sourceRevision: z.string().min(1),
  applyTitle: z.boolean(),
  applyTags: normalizedTagInputArraySchema,
  applyCover: z.boolean(),
  applyUrl: z.boolean(),
});
/** クライアントが送信するリクエストボディ（applyTags は正規化前の生 string[]） */
export type DlsiteApplyBodyInput = z.input<typeof dlsiteApplyBodySchema>;
/** サーバーがパース後に扱う型（applyTags は正規化済み NormalizedTag[]） */
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

/** POST /api/dlsite/apply-missing のリクエスト。workIds 省略時は全作品対象。 */
export const dlsiteApplyMissingBodySchema = z.object({
  workIds: z.array(z.string()).optional(),
});
export type DlsiteApplyMissingBody = z.infer<typeof dlsiteApplyMissingBodySchema>;

export const dlsiteBulkApplyMissingResultSchema = z.object({
  applied: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});
export type DlsiteBulkApplyMissingResult = z.infer<typeof dlsiteBulkApplyMissingResultSchema>;

/** 「未設定項目をまとめて適用」の対象作品1件分の差分。既存値を上書きする項目は含まない
 *  （適用前に差分を表示し、ユーザーが対象を選んでから適用する） */
export const dlsiteApplyMissingPreviewItemSchema = z.object({
  workId: z.string(),
  title: z.string(),
  newTags: normalizedTagArraySchema,
  applyCover: z.boolean(),
  applyUrl: z.boolean(),
});
export type DlsiteApplyMissingPreviewItem = z.infer<typeof dlsiteApplyMissingPreviewItemSchema>;

/** POST /api/dlsite/apply-missing/preview の応答。何も変わらない作品は含まない */
export const dlsiteApplyMissingPreviewSchema = z.object({
  items: z.array(dlsiteApplyMissingPreviewItemSchema),
});
export type DlsiteApplyMissingPreview = z.infer<typeof dlsiteApplyMissingPreviewSchema>;

export const dlsiteStatePatchSchema = z
  .object({
    rjCode: rjCodeFormatSchema.nullable().optional(),
    skipped: z.boolean().optional(),
  })
  .refine((patch) => patch.rjCode !== undefined || patch.skipped !== undefined);
export type DlsiteStatePatch = z.infer<typeof dlsiteStatePatchSchema>;

/** PATCH /api/dlsite/:id。状態変更は正本 CAS のため sourceRevision 必須。 */
export const dlsiteStateUpdateBodySchema = z
  .object({
    sourceRevision: z.string().min(1),
    rjCode: rjCodeFormatSchema.nullable().optional(),
    skipped: z.boolean().optional(),
  })
  .refine((patch) => patch.rjCode !== undefined || patch.skipped !== undefined);
export type DlsiteStateUpdateBody = z.infer<typeof dlsiteStateUpdateBodySchema>;

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

export const dlsiteJobStartResponseSchema = z.object({ jobId: z.string() });
export type DlsiteJobStartResponse = z.infer<typeof dlsiteJobStartResponseSchema>;

export const dlsiteJobCodeSchema = z.object({
  productCode: z.string(),
  origin: dlsiteJobOriginSchema,
  state: dlsiteJobCodeStateSchema,
});
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

/** GET /api/dlsite/jobs/current。finishedのジョブは次のジョブ開始まで残る */
export const dlsiteJobCurrentResponseSchema = z.object({
  job: dlsiteJobSnapshotSchema.nullable(),
});
export type DlsiteJobCurrentResponse = z.infer<typeof dlsiteJobCurrentResponseSchema>;

/** DELETE /api/dlsite/jobs/:jobId/bulk のレスポンス */
export const dlsiteJobCancelBulkResponseSchema = z.object({
  removed: z.number().int().nonnegative(),
});
export type DlsiteJobCancelBulkResponse = z.infer<typeof dlsiteJobCancelBulkResponseSchema>;

/** 進捗SSE。codeは当該コードの現在状態（差分ではない） */
export const dlsiteJobEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("snapshot"), job: dlsiteJobSnapshotSchema.nullable() }),
  z.object({
    type: z.literal("code"),
    jobId: z.string(),
    productCode: z.string(),
    origin: dlsiteJobOriginSchema,
    state: dlsiteJobCodeStateSchema,
    bulk: dlsiteJobBulkProgressSchema,
  }),
  z.object({
    type: z.literal("removed"),
    jobId: z.string(),
    productCodes: z.array(z.string()),
    bulk: dlsiteJobBulkProgressSchema,
  }),
  z.object({
    type: z.literal("finished"),
    jobId: z.string(),
    reason: z.enum(["complete", "aborted"]),
  }),
]);
export type DlsiteJobEvent = z.infer<typeof dlsiteJobEventSchema>;

export type DlsiteProductFetchOutcome = "fetched" | "not_found" | "failed";

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

export function dlsiteProductFetchOutcomeOfResult(
  result: DlsiteFetchResult,
): DlsiteProductFetchOutcome {
  if (result.ok) return "fetched";
  return result.kind === "not_found" ? "not_found" : "failed";
}
