// DLsite スクレイパー（fetch + cheerio）。このファイルのセレクタとフィクスチャテストを正典とする。
// HTML 構造変更を parse_error として検知したら、セレクタとテストを同時に更新する。
// HTML パースは pure 関数に分離し、ネットワークなしでテストできるようにする。
import { load } from "cheerio";
import {
  normalizeDlsiteAgeRating,
  type DlsiteFetchResult,
  type DlsiteWorkInfo,
} from "@mimimilli/shared";
import { DEFAULT_DLSITE_USER_AGENT } from "./dlsiteConfig.ts";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface DlsiteHtmlResponse {
  status: number;
  contentType: string | null;
  body: string;
  transferSize?: number;
}

export interface DlsiteCoverResponse {
  contentType: string | null;
  body: Uint8Array;
  finalUrl: string;
}

async function readLimitedBody(
  response: Response,
  transferMax: number,
  expandedMax: number,
): Promise<{ body: Uint8Array; transferSize: number }> {
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > transferMax)) {
    await response.body?.cancel();
    throw new Error(`DLsiteレスポンスの転送サイズが上限を超えました: ${declared}`);
  }
  if (!response.body) return { body: new Uint8Array(), transferSize: 0 };
  // Content-Lengthが検証済みなら転送サイズは保証済みなので、以降はgzip展開後の実読込量をexpandedMaxで見る
  // （展開後は宣言値より大きくなるのが正常）。Content-Length省略時は転送サイズを事前検証できないため、
  // 実読込量そのものをtransferMaxで打ち切る。
  const readLimit = declared === null ? transferMax : expandedMax;
  const limitLabel = declared === null ? "転送" : "展開";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > readLimit) {
        await reader.cancel();
        throw new Error(`DLsiteレスポンスの${limitLabel}サイズが上限を超えました: ${total}`);
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body, transferSize: declared === null ? total : Number(declared) };
}

// DLsite の作品ページURLはIDのカテゴリprefixで公開ストアが分かれる:
// RJ（同人）は maniax、VJ（商業/美少女ゲーム）は pro。カテゴリを誤ると
// 常に404（not_found）になるため、prefixで振り分ける。
// 例: https://www.dlsite.com/pro/work/=/product_id/VJ014780.html
export function dlsiteWorkUrl(code: string): string {
  const category = code.toUpperCase().startsWith("VJ") ? "pro" : "maniax";
  return `https://www.dlsite.com/${category}/work/=/product_id/${code}.html`;
}

export const DLSITE_OPTIONAL_FIELDS = [
  "circle",
  "cvs",
  "genreTags",
  "ageRating",
  "coverUrl",
] as const;
export type DlsiteOptionalField = (typeof DLSITE_OPTIONAL_FIELDS)[number];

/** パース成功時に取得できなかった任意フィールド名を返す（pure）。 */
export function listDlsiteMissingFields(info: DlsiteWorkInfo): DlsiteOptionalField[] {
  const missing: DlsiteOptionalField[] = [];
  if (!info.circle) missing.push("circle");
  if (info.cvs.length === 0) missing.push("cvs");
  if (info.genreTags.length === 0) missing.push("genreTags");
  if (!info.ageRating) missing.push("ageRating");
  if (!info.coverUrl) missing.push("coverUrl");
  return missing;
}

/** DLsite 作品ページの HTML から作品情報を抽出する（pure） */
export function parseDlsiteHtml(html: string, rjCode: string): DlsiteFetchResult {
  const $ = load(html);

  const title = $("#work_name").first().text().trim();
  if (!title) {
    return {
      ok: false,
      kind: "parse_error",
      message: `DLsite作品ページのタイトルを取得できませんでした（${rjCode}）`,
    };
  }
  const circle = $("span.maker_name a").first().text().trim() || null;

  const cvs: string[] = [];
  let ageRatingRaw = "";
  $("th").each((_, th) => {
    const label = $(th).text().trim();
    if (label === "声優") {
      $(th)
        .parent()
        .find("td a")
        .each((_, a) => {
          const name = $(a).text().trim();
          if (name) cvs.push(name);
        });
      return;
    }
    if (label !== "年齢指定") return;
    ageRatingRaw = $(th).parent().find("td").first().text().trim();
  });

  // 作品ジャンルのリンク先は `/fs/=/genre/` または `/fsr/=/genre/` 形式。
  // main_genre 内には特集・キャンペーンへの通常リンクも混在するため、リンク先で限定する。
  const genreTags = $("div.main_genre a")
    .filter((_, a) => /\/fsr?\/=\/genre\//.test($(a).attr("href") ?? ""))
    .map((_, a) => $(a).text().trim())
    .get()
    .filter((t) => t.length > 0);

  let coverUrl = $("div.product-slider-data div[data-src]").first().attr("data-src") ?? null;
  if (coverUrl && coverUrl.startsWith("//")) coverUrl = `https:${coverUrl}`;

  return {
    ok: true,
    info: {
      rjCode,
      title,
      circle,
      cvs,
      genreTags,
      ageRating: normalizeDlsiteAgeRating(ageRatingRaw),
      coverUrl,
      url: dlsiteWorkUrl(rjCode),
    },
  };
}

/** HTTP取得だけを担当する。パースとキャッシュは呼び出し側で行う。 */
export async function fetchDlsiteHtml(
  rjCode: string,
  fetchImpl: FetchLike = fetch,
  transferMax = Number.MAX_SAFE_INTEGER,
  expandedMax = Number.MAX_SAFE_INTEGER,
  userAgent = DEFAULT_DLSITE_USER_AGENT,
): Promise<DlsiteHtmlResponse> {
  const res = await fetchImpl(dlsiteWorkUrl(rjCode), {
    headers: { Cookie: "adultchecked=1", "User-Agent": userAgent, "Accept-Language": "ja" },
    redirect: "follow",
  });
  const read = await readLimitedBody(res, transferMax, expandedMax);
  return {
    status: res.status,
    contentType: res.headers.get("content-type"),
    body: new TextDecoder().decode(read.body),
    transferSize: read.transferSize,
  };
}

const DLSITE_IMAGE_HOSTS = new Set(["img.dlsite.jp", "img.dlsite.com"]);

/** クライアント由来のURLもここで検証し、任意URLへのアクセスを防ぐ。 */
export function normalizeDlsiteCoverUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || !DLSITE_IMAGE_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("DLsiteカバー画像URLが許可されていません");
  }
  if (url.username || url.password) throw new Error("DLsiteカバー画像URLが不正です");
  if (url.port && url.port !== "443") throw new Error("DLsiteカバー画像URLのポートが不正です");
  url.hash = "";
  return url.toString();
}

/** カバーのHTTP取得だけを担当する。リダイレクト後のURLも再検証する。 */
export async function fetchDlsiteCover(
  coverUrl: string,
  fetchImpl: FetchLike = fetch,
  maximumBytes = Number.MAX_SAFE_INTEGER,
  userAgent = DEFAULT_DLSITE_USER_AGENT,
): Promise<DlsiteCoverResponse> {
  let currentUrl = normalizeDlsiteCoverUrl(coverUrl);
  let res: Response | undefined;
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    const previous = res;
    res = await fetchImpl(currentUrl, {
      headers: { "User-Agent": userAgent },
      redirect: "manual",
    });
    await previous?.body?.cancel();
    if (![301, 302, 303, 307, 308].includes(res.status)) break;
    const location = res.headers.get("location");
    if (!location) throw new Error("カバー画像リダイレクトにLocationがありません");
    currentUrl = normalizeDlsiteCoverUrl(new URL(location, currentUrl).toString());
    if (redirects === 5) throw new Error("カバー画像リダイレクトが多すぎます");
  }
  if (!res) throw new Error("カバー画像を取得できませんでした");
  if (!res.ok) throw new Error(`カバー画像のダウンロードに失敗しました（HTTP ${res.status}）`);
  return {
    contentType: res.headers.get("content-type"),
    body: (await readLimitedBody(res, maximumBytes, maximumBytes)).body,
    finalUrl: currentUrl,
  };
}
