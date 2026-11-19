import {
  dlsiteFetchStateOfResolution,
  type DlsiteCacheResolutionHead,
  type DlsiteFetchResult,
  type DlsiteFetchState,
  type DlsiteHtmlOutcome,
  type DlsiteWorkInfo,
} from "@mimimilli/shared";
import { DLSITE_PARSER_VERSION, parseDlsiteHtml } from "./dlsite.ts";
import type { DlsiteCache } from "./dlsiteCache.ts";

type NonHtmlResolution = Exclude<DlsiteCacheResolutionHead, { kind: "html" }>;

/** キャッシュの判断に、解析結果を足した解決結果。htmlの分岐は本文ではなく解析結果を持つ */
export type DlsiteProductResolution =
  | NonHtmlResolution
  | {
      kind: "html";
      outcome: DlsiteHtmlOutcome;
      fetchedAt: number;
      expiresAt: number;
      result: DlsiteFetchResult;
    };

export type DlsiteProductResolver = (productCode: string) => DlsiteProductResolution;

/**
 * 通常取得の判断（`resolveHead`）に解析結果を合わせる。取得時に保存した解析結果が
 * snapshotと同じ時点・同じパーサーの版であればそれを使い、無いときだけ本文を展開して解析して書き戻す。
 */
export function createDlsiteProductResolver(
  cache: DlsiteCache,
  parse: typeof parseDlsiteHtml = parseDlsiteHtml,
): DlsiteProductResolver {
  return (productCode) => {
    const key = productCode.trim().toUpperCase();
    const head = cache.resolveHead({ productCode: key });
    if (head.kind !== "html") return head;
    if (head.outcome === "parse_error") {
      return {
        ...head,
        result: {
          ok: false,
          kind: "parse_error",
          message: `DLsiteのHTMLを解析できませんでした（${key}）`,
        },
      };
    }
    const stored = cache.readParsed({ productCode: key });
    if (
      stored &&
      stored.contentFetchedAt === head.fetchedAt &&
      stored.parserVersion === DLSITE_PARSER_VERSION
    ) {
      return { ...head, result: { ok: true, info: stored.info } };
    }
    const resolution = cache.resolve({ productCode: key });
    if (resolution.kind !== "html") return resolution;
    const result = parse(resolution.html, key);
    if (resolution.outcome === "ok" && result.ok) {
      cache.writeParsed({ productCode: key }, resolution.fetchedAt, {
        parserVersion: DLSITE_PARSER_VERSION,
        info: result.info,
      });
    }
    const { html: _html, ...rest } = resolution;
    return { ...rest, result };
  };
}

/** 解析に失敗するsnapshotは、outcomeがokでも失敗として扱う */
export function dlsiteFetchStateOfProductResolution(
  resolution: DlsiteProductResolution,
): DlsiteFetchState {
  if (resolution.kind === "html" && !resolution.result.ok) return "failed";
  return dlsiteFetchStateOfResolution(resolution);
}

/** キャッシュから返せる取得結果。missのときはnull（通信が要る） */
export function dlsiteFetchResultOfProductResolution(
  resolution: DlsiteProductResolution,
  productCode: string,
): DlsiteFetchResult | null {
  if (resolution.kind === "miss") return null;
  if (resolution.kind === "failure") {
    return {
      ok: false,
      kind: resolution.outcome,
      message: `DLsite取得キャッシュ: ${resolution.outcome}（${productCode}）`,
    };
  }
  return resolution.result;
}

/** 追加で使えるDLsite情報。TTL内でoutcomeがokのsnapshotを解析できたときだけ返す */
export function readUsableDlsiteInfo(
  resolve: DlsiteProductResolver,
  productCode: string,
): DlsiteWorkInfo | null {
  const resolution = resolve(productCode);
  if (resolution.kind !== "html" || !resolution.result.ok) return null;
  return dlsiteFetchStateOfProductResolution(resolution) === "fetched"
    ? resolution.result.info
    : null;
}
