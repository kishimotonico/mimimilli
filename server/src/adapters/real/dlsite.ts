// DLsite スクレイパー（fetch + cheerio）。このファイルのセレクタとフィクスチャテストを正典とする。
// HTML 構造変更を parse_error として検知したら、セレクタとテストを同時に更新する。
// HTML パースは pure 関数に分離し、ネットワークなしでテストできるようにする。
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "cheerio";
import { normalizeTags } from "@mimimilli/shared";
import type { DlsiteFetchResult, DlsiteWorkInfo } from "@mimimilli/shared";

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) mimimilli/0.1";
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

// DLsite の作品ページURLはIDのカテゴリprefixで公開ストアが分かれる:
// RJ（同人）は maniax、VJ（商業/美少女ゲーム）は pro。カテゴリを誤ると
// 常に404（not_found）になるため、prefixで振り分ける。
// 例: https://www.dlsite.com/pro/work/=/product_id/VJ014780.html
export function dlsiteWorkUrl(code: string): string {
  const category = code.toUpperCase().startsWith("VJ") ? "pro" : "maniax";
  return `https://www.dlsite.com/${category}/work/=/product_id/${code}.html`;
}

/** 候補文字列（フォルダー名 → タイトルの順）から RJ コードを検出する */
export function detectRjCode(candidates: string[]): string | null {
  for (const candidate of candidates) {
    const m = candidate.match(/RJ\d{6,8}/i);
    if (m) return m[0].toUpperCase();
  }
  return null;
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
  $("th").each((_, th) => {
    if ($(th).text().trim() !== "声優") return;
    $(th)
      .parent()
      .find("td a")
      .each((_, a) => {
        const name = $(a).text().trim();
        if (name) cvs.push(name);
      });
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
    info: { rjCode, title, circle, cvs, genreTags, coverUrl, url: dlsiteWorkUrl(rjCode) },
  };
}

/** DLsite から作品情報を取得する（年齢確認は Cookie adultchecked=1 でバイパス） */
export async function fetchDlsiteInfo(
  rjCode: string,
  fetchImpl: FetchLike = fetch,
): Promise<DlsiteFetchResult> {
  try {
    const res = await fetchImpl(dlsiteWorkUrl(rjCode), {
      headers: {
        Cookie: "adultchecked=1",
        "User-Agent": USER_AGENT,
        "Accept-Language": "ja",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status === 404) {
      return {
        ok: false,
        kind: "not_found",
        message: `DLsite作品が見つかりません（${rjCode}）`,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        kind: "error",
        message: `DLsiteの取得に失敗しました（${rjCode}: HTTP ${res.status}）`,
      };
    }
    return parseDlsiteHtml(await res.text(), rjCode);
  } catch (error) {
    return {
      ok: false,
      kind: "error",
      message: `DLsiteとの通信に失敗しました（${rjCode}: ${(error as Error).message}）`,
    };
  }
}

/**
 * 取得情報を既存タグへマージする（要件 v4 §4.4 の prefix 変換）。
 * circle → `サークル/`, cvs → `cv/`, genreTags → `genre/`
 * 結果は正規形（ADR-0005 決定5）で返し、正規化後の重複は追加しない
 */
export function mergeDlsiteTags(existing: string[], info: DlsiteWorkInfo): string[] {
  const merged = [...existing];
  if (info.circle) merged.push(`サークル/${info.circle}`);
  for (const cv of info.cvs) merged.push(`cv/${cv}`);
  for (const genre of info.genreTags) merged.push(`genre/${genre}`);
  return normalizeTags(merged);
}

/** カバー画像をダウンロードして作品フォルダーへ保存し、ファイル名を返す */
export async function downloadCover(coverUrl: string, workDir: string): Promise<string> {
  const res = await fetch(coverUrl, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`カバー画像のダウンロードに失敗しました（HTTP ${res.status}）`);
  }
  const ext = (new URL(coverUrl).pathname.split(".").pop() ?? "jpg").toLowerCase();
  const fileName = `dlsite_cover.${ext}`;
  writeFileSync(join(workDir, fileName), Buffer.from(await res.arrayBuffer()));
  return fileName;
}
