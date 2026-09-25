// DLsite 連携（POST /api/dlsite/:id/fetch | apply）の契約。
import { z } from "zod";
import { dataIntegrityWarningSchema } from "./dataIntegrity.ts";
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
export type DlsiteCacheResolution =
  | {
      kind: "html";
      outcome: DlsiteHtmlOutcome;
      fetchedAt: number;
      expiresAt: number;
      html: string;
    }
  | { kind: "failure"; outcome: DlsiteFailureOutcome; attemptedAt: number; expiresAt: number }
  | { kind: "miss"; reason: DlsiteCacheMissReason };

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
 *  通知ベルの「まとめて取得」対象件数（TASK-44）の判定基準。
 *  POST /dlsite/bulk（mode: "existing"）は取得失敗（error）も再試行対象に含めるため、
 *  実際に処理される件数とは意図的に区別している（error は isDlsiteFetchFailed 側で別掲する）。 */
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

export const dlsiteWorkInfoSchema = z.object({
  rjCode: z.string(),
  title: z.string(),
  circle: z.string().nullable(),
  cvs: z.array(z.string()),
  genreTags: z.array(z.string()),
  ageRating: dlsiteAgeRatingSchema.nullable(),
  coverUrl: z.string().nullable(),
  url: z.string(),
});
export type DlsiteWorkInfo = z.infer<typeof dlsiteWorkInfoSchema>;

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
  const applyUrl = !work.urls.some((entry) => entry.url.includes("dlsite.com"));
  return { newTags, applyCover, applyUrl };
}

/** dlsiteApplyMissing（未設定項目まとめ適用）のtags/urls/linkageパッチを組み立てる。
 *  real/fixture 両adapterが共有する。差分が無ければnull（何も書かない）。
 *  linkageは単体適用と同じ規則で status: "applied" にする（title/coverはこの関数の対象外）。 */
export function buildDlsiteMissingApplyPatch(
  current: {
    tags: readonly NormalizedTag[];
    urls: readonly { label: string; url: string }[];
    dlsite: MetaDlsiteState;
  },
  info: DlsiteWorkInfo,
  diff: { newTags: readonly NormalizedTag[]; applyCover: boolean; applyUrl: boolean },
): Omit<DlsiteApplyPatch, "title"> | null {
  if (diff.newTags.length === 0 && !diff.applyCover && !diff.applyUrl) return null;
  return {
    tags: diff.newTags.length > 0 ? mergeAppliedDlsiteTags(current.tags, diff.newTags) : undefined,
    urls:
      diff.applyUrl && info.url
        ? [
            ...current.urls.filter((entry) => !entry.url.includes("dlsite.com")),
            { label: "DLsite", url: info.url },
          ]
        : undefined,
    dlsite: {
      rjCode: info.rjCode,
      status: "applied",
      appliedTags: dedupeTags([...current.dlsite.appliedTags, ...diff.newTags]),
    },
  };
}

/** dlsiteApply（単体適用）のパッチ。cover は非同期I/Oを伴うため呼び出し側が別途解決し、
 *  {@link buildDlsiteApplyPatch} には含めない。title/tags/urls は未変更なら undefined。 */
export interface DlsiteApplyPatch {
  title?: string;
  tags?: NormalizedTag[];
  urls?: { label: string; url: string }[];
  dlsite: MetaDlsiteState;
}

/** dlsiteApply（単体適用）のtitle/tags/urlsパッチを組み立てる。real/fixture 両adapterが共有する。 */
export function buildDlsiteApplyPatch(
  current: {
    title: string;
    tags: readonly NormalizedTag[];
    urls: readonly { label: string; url: string }[];
    dlsite: MetaDlsiteState;
  },
  body: DlsiteApplyBody,
): DlsiteApplyPatch {
  const { applyTags } = body;
  return {
    title: body.applyTitle && body.info.title ? body.info.title : undefined,
    tags: applyTags.length > 0 ? mergeAppliedDlsiteTags(current.tags, applyTags) : undefined,
    urls:
      body.applyUrl && body.info.url
        ? [
            ...current.urls.filter((entry) => !entry.url.includes("dlsite.com")),
            { label: "DLsite", url: body.info.url },
          ]
        : undefined,
    dlsite: {
      rjCode: body.info.rjCode,
      status: "applied",
      appliedTags: dedupeTags([...current.dlsite.appliedTags, ...applyTags]),
    },
  };
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

/** 新規登録時はmimimilli.jsonがまだ存在しないためCASトークンを持たない。 */
export const dlsiteRegistrationBodySchema = dlsiteApplyBodySchema.omit({ sourceRevision: true });
export type DlsiteRegistrationBody = z.output<typeof dlsiteRegistrationBodySchema>;

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

/** RJ/VJコードの形式。DLsiteキャッシュが受け付ける形式（`^(RJ|VJ)\d{6,8}$`）と一致させる。 */
export const RJ_CODE_PATTERN = /^(RJ|VJ)\d{6,8}$/i;

/** 非空のRJ/VJコード1件の形式検証・正規化（大文字化）の正典。
 *  空文字（RJコードなしの明示）・未指定は呼び出し側で個別に扱う。 */
export const rjCodeFormatSchema = z
  .string()
  .trim()
  .regex(RJ_CODE_PATTERN, "RJ/VJコードはRJまたはVJに続く6〜8桁で入力してください")
  .transform((value) => value.toUpperCase());

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
 *  未取得に戻す。skipped 指定時は従来どおり status を上書きする（rjCode 変更より後に適用）。 */
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

export const dlsiteBulkModeSchema = z.enum(["new", "existing"]);
export type DlsiteBulkMode = z.infer<typeof dlsiteBulkModeSchema>;

/** POST /api/dlsite/bulk のジョブ開始レスポンス */
export const dlsiteBulkStartResponseSchema = z.object({
  started: z.literal(true),
});
export type DlsiteBulkStartResponse = z.infer<typeof dlsiteBulkStartResponseSchema>;

export const dlsiteBulkResultSchema = z.object({
  fetched: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  parseErrors: z.number().int().nonnegative(),
  /** 一括処理の対象外だった作品数（RJ未設定・適用済み・skipped 等） */
  skipped: z.number().int().nonnegative(),
  /** listSummaries でタグ等の不整合により除外した作品 */
  dataIntegrityWarning: dataIntegrityWarningSchema.optional(),
});
export type DlsiteBulkResult = z.infer<typeof dlsiteBulkResultSchema>;

/** 一括取得で現在処理中の作品。全件終わった直後は null */
export const dlsiteBulkProgressWorkSchema = z.object({
  id: z.string(),
  rjCode: z.string(),
  title: z.string(),
});
export type DlsiteBulkProgressWork = z.infer<typeof dlsiteBulkProgressWorkSchema>;

export const dlsiteBulkProgressEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("progress"),
    processed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    work: dlsiteBulkProgressWorkSchema.nullable(),
  }),
  z.object({ type: z.literal("cancelling") }),
  z.object({ type: z.literal("complete"), result: dlsiteBulkResultSchema }),
  z.object({ type: z.literal("cancelled"), result: dlsiteBulkResultSchema }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type DlsiteBulkProgressEvent = z.infer<typeof dlsiteBulkProgressEventSchema>;

/** DELETE /api/dlsite/bulk のレスポンス */
export const dlsiteBulkCancelResponseSchema = z.object({
  cancelling: z.literal(true),
});
export type DlsiteBulkCancelResponse = z.infer<typeof dlsiteBulkCancelResponseSchema>;

const dlsiteBulkProgressSnapshotSchema = z.object({
  processed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  work: dlsiteBulkProgressWorkSchema.nullable(),
});
export type DlsiteBulkProgressSnapshot = z.infer<typeof dlsiteBulkProgressSnapshotSchema>;

/** GET /api/dlsite/bulk のジョブ状態（実行中・直近の終了結果）。未実行・終了後クリア時は 204 */
export const dlsiteBulkSnapshotSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("running"),
    progress: dlsiteBulkProgressSnapshotSchema.nullable(),
  }),
  z.object({
    status: z.literal("cancelling"),
    progress: dlsiteBulkProgressSnapshotSchema.nullable(),
  }),
  z.object({ status: z.literal("complete"), result: dlsiteBulkResultSchema }),
  z.object({ status: z.literal("cancelled"), result: dlsiteBulkResultSchema }),
  z.object({ status: z.literal("error"), message: z.string() }),
]);
export type DlsiteBulkSnapshot = z.infer<typeof dlsiteBulkSnapshotSchema>;
