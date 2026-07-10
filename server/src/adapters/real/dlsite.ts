// DLsite スクレイパー（fetch + cheerio）。
// セレクタは docs/HANDOFF.md「DLsiteスクレイピングのセレクタ」を正典とする
// （DLsite の HTML 構造変更時はここを修正する）。
// HTML パースは pure 関数に分離し、ネットワークなしでテストできるようにする。
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "cheerio";
import type { DlsiteWorkInfo } from "@mimimilli/shared";

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) mimimilli/0.1";

export function dlsiteWorkUrl(rjCode: string): string {
  return `https://www.dlsite.com/maniax/work/=/product_id/${rjCode}.html`;
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
export function parseDlsiteHtml(html: string, rjCode: string): DlsiteWorkInfo {
  const $ = load(html);

  const title = $("#work_name").first().text().trim();
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

  const genreTags = $("div.main_genre a")
    .map((_, a) => $(a).text().trim())
    .get()
    .filter((t) => t.length > 0);

  let coverUrl = $("div.product-slider-data div[data-src]").first().attr("data-src") ?? null;
  if (coverUrl && coverUrl.startsWith("//")) coverUrl = `https:${coverUrl}`;

  return { rjCode, title, circle, cvs, genreTags, coverUrl, url: dlsiteWorkUrl(rjCode) };
}

/** DLsite から作品情報を取得する（年齢確認は Cookie adultchecked=1 でバイパス） */
export async function fetchDlsiteInfo(rjCode: string): Promise<DlsiteWorkInfo> {
  const res = await fetch(dlsiteWorkUrl(rjCode), {
    headers: {
      Cookie: "adultchecked=1",
      "User-Agent": USER_AGENT,
      "Accept-Language": "ja",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`DLsite の取得に失敗しました（${rjCode}: HTTP ${res.status}）`);
  }
  return parseDlsiteHtml(await res.text(), rjCode);
}

/**
 * 取得情報を既存タグへマージする（要件 v4 §4.4 の prefix 変換、重複は追加しない）。
 * circle → `サークル/`, cvs → `cv/`, genreTags → `genre/`
 */
export function mergeDlsiteTags(existing: string[], info: DlsiteWorkInfo): string[] {
  const merged = [...existing];
  const push = (tag: string) => {
    if (!merged.includes(tag)) merged.push(tag);
  };
  if (info.circle) push(`サークル/${info.circle}`);
  for (const cv of info.cvs) push(`cv/${cv}`);
  for (const genre of info.genreTags) push(`genre/${genre}`);
  return merged;
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
