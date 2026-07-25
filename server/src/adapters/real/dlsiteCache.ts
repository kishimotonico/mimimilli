import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { Database } from "bun:sqlite";

export const DLSITE_CACHE_REPRESENTATION = "work-html-ja-adultchecked-v1";
export const DLSITE_CACHE_RESOURCE_KIND = "work_html";
export const DLSITE_COVER_CACHE_RESOURCE_KIND = "cover_image";
export const DEFAULT_DLSITE_CACHE_TTLS_MS = {
  ok: 30 * 24 * 60 * 60 * 1000,
  parse_error: 60 * 60 * 1000,
  not_found: 3 * 24 * 60 * 60 * 1000,
  error: 60 * 60 * 1000,
} as const;
export const DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES = 2 * 1024 * 1024;
export const DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES = 8 * 1024 * 1024;

export type DlsiteCacheOutcome = keyof typeof DEFAULT_DLSITE_CACHE_TTLS_MS;
export type DlsiteStore = "maniax" | "pro";

export interface DlsiteCacheKey {
  resourceKind?: string;
  productCode: string;
  representation?: string;
}

export interface DlsiteCacheEntry {
  resourceKind: string;
  store: DlsiteStore;
  productCode: string;
  representation: string;
  outcome: DlsiteCacheOutcome;
  fetchedAt: number;
  expiresAt: number;
  contentType: string | null;
  transferSize: number | null;
  html: string | null;
}

export interface DlsiteCacheOptions {
  path: string;
  ttlsMs?: Partial<Record<DlsiteCacheOutcome, number>>;
  maxTransferBytes?: number;
  maxExpandedBytes?: number;
  clock?: () => number;
}

export interface DlsiteCacheConfig {
  path: string;
  ttlsMs: Record<DlsiteCacheOutcome, number>;
  maxTransferBytes: number;
  maxExpandedBytes: number;
}

export interface DlsiteHtmlInputMetadata {
  contentType: string;
  transferSize: number;
  expandedSize: number;
}

type StoredRow = {
  resource_kind: string;
  store: DlsiteStore;
  product_code: string;
  representation: string;
  outcome: DlsiteCacheOutcome;
  fetched_at: number;
  expires_at: number;
  content_type: string | null;
  transfer_size: number | null;
  html_gzip: Uint8Array | null;
  html_size: number | null;
};

function requirePositiveSafeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} は1以上の安全な整数で指定してください`);
  }
  return value;
}

function requireNonNegativeSafeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} は0以上の安全な整数で指定してください`);
  }
  return value;
}

function envPositiveInteger(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const value = env[name];
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${name} は1以上の整数（ミリ秒またはバイト）で指定してください`);
  }
  return requirePositiveSafeInteger(Number(value), name);
}

/** 環境変数を曖昧に解釈せず、DLsiteキャッシュの設定を組み立てる。 */
export function resolveDlsiteCacheConfig(
  defaultPath: string,
  env: NodeJS.ProcessEnv = process.env,
): DlsiteCacheConfig {
  const configuredPath = env.MIMIKAGO_DLSITE_CACHE_DB;
  if (configuredPath !== undefined && (!configuredPath || !isAbsolute(configuredPath))) {
    throw new Error("MIMIKAGO_DLSITE_CACHE_DB は空でない絶対パスで指定してください");
  }
  return {
    path: configuredPath ?? defaultPath,
    ttlsMs: {
      ok: envPositiveInteger(
        env,
        "MIMIKAGO_DLSITE_CACHE_TTL_OK_MS",
        DEFAULT_DLSITE_CACHE_TTLS_MS.ok,
      ),
      parse_error: envPositiveInteger(
        env,
        "MIMIKAGO_DLSITE_CACHE_TTL_PARSE_ERROR_MS",
        DEFAULT_DLSITE_CACHE_TTLS_MS.parse_error,
      ),
      not_found: envPositiveInteger(
        env,
        "MIMIKAGO_DLSITE_CACHE_TTL_NOT_FOUND_MS",
        DEFAULT_DLSITE_CACHE_TTLS_MS.not_found,
      ),
      error: envPositiveInteger(
        env,
        "MIMIKAGO_DLSITE_CACHE_TTL_ERROR_MS",
        DEFAULT_DLSITE_CACHE_TTLS_MS.error,
      ),
    },
    maxTransferBytes: envPositiveInteger(
      env,
      "MIMIKAGO_DLSITE_CACHE_MAX_TRANSFER_BYTES",
      DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES,
    ),
    maxExpandedBytes: envPositiveInteger(
      env,
      "MIMIKAGO_DLSITE_CACHE_MAX_EXPANDED_BYTES",
      DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES,
    ),
  };
}

export function normalizeDlsiteProductCode(code: string): {
  productCode: string;
  store: DlsiteStore;
} {
  const productCode = code.trim().toUpperCase();
  const match = /^(RJ|VJ)\d{6,8}$/.exec(productCode);
  if (!match) throw new Error(`DLsite product_codeの形式が不正です: ${code}`);
  return { productCode, store: match[1] === "RJ" ? "maniax" : "pro" };
}

function normalizeKey(key: DlsiteCacheKey): {
  resourceKind: string;
  store: DlsiteStore;
  productCode: string;
  representation: string;
} {
  const { productCode, store } = normalizeDlsiteProductCode(key.productCode);
  const resourceKind = key.resourceKind ?? DLSITE_CACHE_RESOURCE_KIND;
  const representation = key.representation ?? DLSITE_CACHE_REPRESENTATION;
  if (!resourceKind || !representation) throw new Error("キャッシュキーの名前空間は空にできません");
  return { resourceKind, store, productCode, representation };
}

/**
 * HTTP入力の検証契約。transferSizeとexpandedSizeは意図的に分ける。
 * 現在のHTML保存は展開済みbodyを受け取るが、TASK-93.2では圧縮HTTP応答にも同じ検証を使う。
 */
export function validateDlsiteHtmlInput(
  input: DlsiteHtmlInputMetadata,
  maxTransferBytes: number,
  maxExpandedBytes: number,
): void {
  if (!/^text\/html(?:\s*;|$)/i.test(input.contentType)) {
    throw new Error(`DLsite HTMLのContent-Typeが不正です: ${input.contentType}`);
  }
  requireNonNegativeSafeInteger(input.transferSize, "DLsite HTMLの転送サイズ");
  requireNonNegativeSafeInteger(input.expandedSize, "DLsite HTMLの展開サイズ");
  if (input.transferSize > maxTransferBytes) {
    throw new Error(`DLsite HTMLの転送サイズが上限を超えました: ${input.transferSize}`);
  }
  if (input.expandedSize > maxExpandedBytes) {
    throw new Error(`DLsite HTMLの展開サイズが上限を超えました: ${input.expandedSize}`);
  }
}

export class DlsiteCache {
  private readonly sqlite: Database;
  private readonly ttlsMs: Record<DlsiteCacheOutcome, number>;
  private readonly maxTransferBytes: number;
  private readonly maxExpandedBytes: number;
  private readonly clock: () => number;

  constructor(options: DlsiteCacheOptions) {
    mkdirSync(dirname(options.path), { recursive: true });
    this.sqlite = new Database(options.path, { create: true });
    this.sqlite.exec("PRAGMA journal_mode = WAL");
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS dlsite_cache_entries (
        resource_kind TEXT NOT NULL,
        store TEXT NOT NULL CHECK(store IN ('maniax', 'pro')),
        product_code TEXT NOT NULL,
        representation TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK(outcome IN ('ok', 'parse_error', 'not_found', 'error')),
        fetched_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        content_type TEXT,
        transfer_size INTEGER,
        html_gzip BLOB,
        html_size INTEGER,
        PRIMARY KEY (resource_kind, store, product_code, representation)
      );
      CREATE INDEX IF NOT EXISTS dlsite_cache_entries_expires_at ON dlsite_cache_entries(expires_at);
      CREATE TABLE IF NOT EXISTS dlsite_cover_entries (
        cache_key TEXT PRIMARY KEY,
        normalized_url TEXT NOT NULL,
        content_type TEXT,
        body BLOB NOT NULL,
        fetched_at INTEGER NOT NULL
      );
    `);
    this.ttlsMs = { ...DEFAULT_DLSITE_CACHE_TTLS_MS, ...options.ttlsMs };
    for (const [outcome, ttl] of Object.entries(this.ttlsMs))
      requirePositiveSafeInteger(ttl, `${outcome} TTL`);
    this.maxTransferBytes = requirePositiveSafeInteger(
      options.maxTransferBytes ?? DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES,
      "maxTransferBytes",
    );
    this.maxExpandedBytes = requirePositiveSafeInteger(
      options.maxExpandedBytes ?? DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES,
      "maxExpandedBytes",
    );
    this.clock = options.clock ?? Date.now;
  }

  putHtml(
    input: DlsiteCacheKey & {
      outcome: "ok" | "parse_error";
      contentType: string;
      html: string | Uint8Array;
      transferSize?: number;
    },
  ): void {
    const bytes = typeof input.html === "string" ? Buffer.from(input.html) : input.html;
    const transferSize = input.transferSize ?? bytes.byteLength;
    validateDlsiteHtmlInput(
      { contentType: input.contentType, transferSize, expandedSize: bytes.byteLength },
      this.maxTransferBytes,
      this.maxExpandedBytes,
    );
    this.putRow(input, input.contentType, bytes, transferSize);
  }

  putNegative(input: DlsiteCacheKey & { outcome: "not_found" | "error" }): void {
    this.putRow(input, null, null, null);
  }

  private putRow(
    input: DlsiteCacheKey & { outcome: DlsiteCacheOutcome },
    contentType: string | null,
    bytes: Uint8Array | null,
    transferSize: number | null,
  ): void {
    const key = normalizeKey(input);
    const fetchedAt = this.clock();
    requirePositiveSafeInteger(fetchedAt, "clockの返り値");
    const expiresAt = fetchedAt + this.ttlsMs[input.outcome];
    requirePositiveSafeInteger(expiresAt, "fetched_at + TTL");
    const htmlGzip = bytes === null ? null : gzipSync(bytes);
    const write = this.sqlite.transaction(() => {
      this.sqlite
        .query(
          `INSERT INTO dlsite_cache_entries
            (resource_kind, store, product_code, representation, outcome, fetched_at, expires_at, content_type, transfer_size, html_gzip, html_size)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(resource_kind, store, product_code, representation) DO UPDATE SET
             outcome = excluded.outcome, fetched_at = excluded.fetched_at, expires_at = excluded.expires_at,
             content_type = excluded.content_type, transfer_size = excluded.transfer_size,
             html_gzip = excluded.html_gzip, html_size = excluded.html_size`,
        )
        .run(
          key.resourceKind,
          key.store,
          key.productCode,
          key.representation,
          input.outcome,
          fetchedAt,
          expiresAt,
          contentType,
          transferSize,
          htmlGzip,
          bytes?.byteLength ?? null,
        );
    });
    write();
  }

  get(keyInput: DlsiteCacheKey): DlsiteCacheEntry | null {
    return this.read(keyInput, false);
  }

  /** 期限切れ本文を診断・更新制御にだけ使う。通常取得には返さない。 */
  getStored(keyInput: DlsiteCacheKey): DlsiteCacheEntry | null {
    return this.read(keyInput, true);
  }

  expire(keyInput: DlsiteCacheKey): void {
    const key = normalizeKey(keyInput);
    this.sqlite
      .query(
        `UPDATE dlsite_cache_entries SET expires_at = 0
         WHERE resource_kind = ? AND store = ? AND product_code = ? AND representation = ?`,
      )
      .run(key.resourceKind, key.store, key.productCode, key.representation);
  }

  private read(keyInput: DlsiteCacheKey, includeExpired: boolean): DlsiteCacheEntry | null {
    const key = normalizeKey(keyInput);
    const row = this.sqlite
      .query(
        `SELECT resource_kind, store, product_code, representation, outcome, fetched_at, expires_at,
                content_type, transfer_size, html_gzip, html_size
         FROM dlsite_cache_entries
         WHERE resource_kind = ? AND store = ? AND product_code = ? AND representation = ?`,
      )
      .get(key.resourceKind, key.store, key.productCode, key.representation) as StoredRow | null;
    if (!row || (!includeExpired && row.expires_at <= this.clock())) return null;
    let html: string | null = null;
    if (row.html_gzip !== null) {
      let bytes: Buffer;
      try {
        // 展開完了後の検査ではgzip bombに対して遅い。zlib自身に出力上限を渡す。
        bytes = gunzipSync(row.html_gzip, { maxOutputLength: this.maxExpandedBytes });
      } catch (error) {
        throw new Error("DLsiteキャッシュのgzip展開に失敗しました", { cause: error });
      }
      if (bytes.byteLength > this.maxExpandedBytes || bytes.byteLength !== row.html_size) {
        throw new Error("DLsiteキャッシュのgzip展開サイズが不正です");
      }
      html = bytes.toString("utf8");
    }
    return {
      resourceKind: row.resource_kind,
      store: row.store,
      productCode: row.product_code,
      representation: row.representation,
      outcome: row.outcome,
      fetchedAt: row.fetched_at,
      expiresAt: row.expires_at,
      contentType: row.content_type,
      transferSize: row.transfer_size,
      html,
    };
  }

  /** cover URLの正規化済み表現を含むキー。画像は圧縮しない。 */
  static coverKey(normalizedUrl: string): string {
    return createHash("sha256").update(normalizedUrl).digest("hex");
  }

  getCover(normalizedUrl: string): { body: Uint8Array; contentType: string | null } | null {
    const row = this.sqlite
      .query("SELECT body, content_type FROM dlsite_cover_entries WHERE cache_key = ?")
      .get(DlsiteCache.coverKey(normalizedUrl)) as {
      body: Uint8Array;
      content_type: string | null;
    } | null;
    return row ? { body: new Uint8Array(row.body), contentType: row.content_type } : null;
  }

  putCover(normalizedUrl: string, body: Uint8Array, contentType: string | null): void {
    if (body.byteLength === 0) throw new Error("DLsiteカバー画像が空です");
    if (body.byteLength > this.maxTransferBytes)
      throw new Error("DLsiteカバー画像が上限を超えました");
    if (!/^image\/(?:jpeg|png|webp|gif)(?:\s*;|$)/i.test(contentType ?? "")) {
      throw new Error(`DLsiteカバー画像のContent-Typeが不正です: ${contentType ?? ""}`);
    }
    this.sqlite
      .query(
        `INSERT INTO dlsite_cover_entries (cache_key, normalized_url, content_type, body, fetched_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET normalized_url = excluded.normalized_url,
           content_type = excluded.content_type, body = excluded.body, fetched_at = excluded.fetched_at`,
      )
      .run(DlsiteCache.coverKey(normalizedUrl), normalizedUrl, contentType, body, this.clock());
  }

  cleanupExpired(): number {
    return this.sqlite
      .query("DELETE FROM dlsite_cache_entries WHERE expires_at <= ?")
      .run(this.clock()).changes;
  }

  status(): { entries: number; bytes: number } {
    const entries = (
      this.sqlite.query("SELECT COUNT(*) AS count FROM dlsite_cache_entries").get() as {
        count: number;
      }
    ).count;
    // WAL と SHM を含め、運用時に実際に占有しているファイルサイズを返す。
    const bytes = ["", "-wal", "-shm"].reduce((total, suffix) => {
      const path = `${this.sqlite.filename}${suffix}`;
      return total + (existsSync(path) ? statSync(path).size : 0);
    }, 0);
    return { entries, bytes };
  }

  close(): void {
    this.sqlite.close();
  }
}
