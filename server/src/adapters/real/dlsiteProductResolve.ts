import {
  dlsiteFetchStateOfResolution,
  type DlsiteCacheResolutionHead,
  type DlsiteFetchResult,
  type DlsiteFetchState,
  type DlsiteHtmlOutcome,
  type DlsiteWorkInfo,
} from "@mimimilli/shared";
import type { DlsiteParser } from "./dlsite.ts";
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
      /** 解析結果の取得時刻とパーサー版の組。適用の照合値で、中身は呼び出し側が解釈しない */
      revision: string;
      result: DlsiteFetchResult;
    };

export type DlsiteProductResolver = (productCode: string) => DlsiteProductResolution;

/**
 * 通常取得の判断（`resolveHead`）に解析結果を合わせる。取得時に保存した解析結果が
 * snapshotと同じ時点・同じパーサーの版であればそれを使い、無いときだけ本文を展開して解析して書き戻す。
 */
export function createDlsiteProductResolver(
  cache: DlsiteCache,
  parser: DlsiteParser,
): DlsiteProductResolver {
  return (productCode) => {
    const key = productCode.trim().toUpperCase();
    const head = cache.resolveHead({ productCode: key });
    if (head.kind !== "html") return head;
    const revision = `${head.fetchedAt}:${parser.version}`;
    if (head.outcome === "parse_error") {
      return {
        ...head,
        revision,
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
      stored.parserVersion === parser.version
    ) {
      return { ...head, revision, result: { ok: true, info: stored.info } };
    }
    const resolution = cache.resolve({ productCode: key });
    if (resolution.kind !== "html") return resolution;
    const result = parser.parse(resolution.html, key);
    if (resolution.outcome === "ok" && result.ok) {
      cache.writeParsed({ productCode: key }, resolution.fetchedAt, {
        parserVersion: parser.version,
        info: result.info,
      });
    }
    const { html: _html, ...rest } = resolution;
    return { ...rest, revision, result };
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

/** 追加・適用で使えるDLsite情報。TTL内でoutcomeがokのsnapshotを解析できたときだけ返す。
 *  revision は解決結果の revision（取得時刻とパーサー版の組） */
export function readUsableDlsite(
  resolve: DlsiteProductResolver,
  productCode: string,
): { info: DlsiteWorkInfo; revision: string } | null {
  const resolution = resolve(productCode);
  if (resolution.kind !== "html" || !resolution.result.ok) return null;
  return dlsiteFetchStateOfProductResolution(resolution) === "fetched"
    ? { info: resolution.result.info, revision: resolution.revision }
    : null;
}
