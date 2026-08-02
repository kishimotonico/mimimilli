import type { DlsiteSchedulerDependencies } from "../../src/adapters/real/dlsiteScheduler.ts";
import { dlsiteWorkUrl } from "../../src/adapters/real/dlsite.ts";

function requestUrl(input: string | URL | Request): URL {
  if (typeof input === "string") return new URL(input);
  if (input instanceof URL) return input;
  return new URL(input.url);
}

export function productCodeFromRequest(input: string | URL | Request): string | null {
  const match = requestUrl(input).href.match(/product_id\/(R[JV]\d+)\.html/i);
  return match ? match[1]!.toUpperCase() : null;
}

export function coverUrlFromRequest(input: string | URL | Request): string | null {
  const url = requestUrl(input);
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (host !== "img.dlsite.jp" && host !== "img.dlsite.com") return null;
  return url.toString();
}

export function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export function jpegResponse(body: Uint8Array): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "image/jpeg" },
  });
}

export interface MockDlsiteTransportOptions {
  html?: (code: string, url: URL, init?: RequestInit) => Response | Promise<Response>;
  cover?: (url: string, init?: RequestInit) => Response | Promise<Response>;
  handler?: (url: URL, init?: RequestInit) => Response | Promise<Response>;
}

export function mockDlsiteTransport(
  options: MockDlsiteTransportOptions,
): DlsiteSchedulerDependencies {
  return {
    transport: (input, init) => {
      try {
        const url = requestUrl(input);
        let result: Response | Promise<Response>;
        if (options.handler) result = options.handler(url, init);
        else {
          const code = productCodeFromRequest(input);
          if (code && options.html) result = options.html(code, url, init);
          else {
            const coverUrl = coverUrlFromRequest(input);
            if (coverUrl && options.cover) result = options.cover(coverUrl, init);
            else result = new Response("not found", { status: 404 });
          }
        }
        return result instanceof Promise ? result : Promise.resolve(result);
      } catch (error) {
        return Promise.reject(error);
      }
    },
  };
}

export function sampleWorkHtml(
  code: string,
  options?: {
    title?: string;
    circle?: string | null;
    genres?: string[];
    cover?: boolean;
    cvs?: string[] | false;
  },
): string {
  const title = options?.title ?? "耳元ささやきの夜";
  const circleBlock =
    options?.circle === null
      ? ""
      : `<span class="maker_name"><a href="#">${options?.circle ?? "夜想曲"}</a></span>`;
  const genres = options?.genres ?? ["耳かき", "バイノーラル"];
  const genreLinks = genres
    .map((genre) => `<a href="/maniax/fs/=/genre/123/from/work.genre">${genre}</a>`)
    .join("\n    ");
  const cvBlock =
    options?.cvs === false
      ? ""
      : `<tr><th>声優</th><td>${(options?.cvs ?? ["水瀬なずな"])
          .map((name) => `<a href="#">${name}</a>`)
          .join(" / ")}</td></tr>`;
  const coverBlock =
    options?.cover === false
      ? ""
      : `<div class="product-slider-data">
    <div data-src="//img.dlsite.jp/modpub/images2/work/doujin/RJ900000/${code}_img_main.jpg"></div>
  </div>`;
  return `<html><body>
  <h1 id="work_name">${title}</h1>
  ${circleBlock}
  <table>
    <tr><th>販売日</th><td>2026年01月01日</td></tr>
    ${cvBlock}
  </table>
  <div class="main_genre">
    ${genreLinks}
  </div>
  ${coverBlock}
</body></html>`;
}

export function workPageUrl(code: string): string {
  return dlsiteWorkUrl(code);
}
