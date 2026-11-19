import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { Database } from "bun:sqlite";
import {
  DEFAULT_DLSITE_CACHE_TTLS_MS,
  RJ_CODE_PATTERN,
  dlsiteWorkInfoSchema,
  type DlsiteCacheOutcome,
  type DlsiteCacheResolution,
  type DlsiteCacheResolutionHead,
  type DlsiteFailureOutcome,
  type DlsiteHtmlOutcome,
  type DlsiteWorkInfo,
} from "@mimimilli/shared";
import { applySqliteBusyTimeout } from "./sqliteConnection.ts";

export type {
  DlsiteCacheMissReason,
  DlsiteCacheOutcome,
  DlsiteCacheResolution,
  DlsiteCacheResolutionHead,
} from "@mimimilli/shared";
export { DEFAULT_DLSITE_CACHE_TTLS_MS };

export const DLSITE_CACHE_MEMORY_PATH = ":memory:" as const;
export const DLSITE_CACHE_REPRESENTATION = "work-html-ja-adultchecked-v1";
export const DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES = 2 * 1024 * 1024;
export const DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES = 8 * 1024 * 1024;

export type DlsiteStore = "maniax" | "pro";

export interface DlsiteCacheKey {
  productCode: string;
  representation?: string;
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
  /** HTTP応答の受信バイト数。ローカル入力では転送そのものがないため省略する。 */
  transferSize?: number;
  expandedSize: number;
}

type NormalizedKey = {
  store: DlsiteStore;
  productCode: string;
  representation: string;
};

type SnapshotMetaRow = {
  outcome: DlsiteHtmlOutcome;
  content_fetched_at: number;
  content_expires_at: number;
};

type SnapshotBodyRow = {
  html_gzip: Uint8Array;
  html_size: number;
};

/** snapshotの取得時にパーサーが読んだ結果。content_fetched_at と版が一致する間だけ有効 */
export interface DlsiteParsedEntry {
  contentFetchedAt: number;
  parserVersion: number;
  info: DlsiteWorkInfo;
}

type ParsedRow = {
  content_fetched_at: number;
  parser_version: number;
  info_json: string;
};

type FailureRow = {
  failure_kind: DlsiteFailureOutcome;
  attempted_at: number;
  failure_expires_at: number;
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

/** 環境変数を曖昧に解釈せず、DLsiteキャッシュの設定を組み立てる。 */
export function resolveDlsiteCacheConfig(
  defaultPath: string,
  env: NodeJS.ProcessEnv = process.env,
): DlsiteCacheConfig {
  const configuredPath = env.MIMIMILLI_DLSITE_CACHE_DB;
  if (configuredPath !== undefined && (!configuredPath || !isAbsolute(configuredPath))) {
    throw new Error("MIMIMILLI_DLSITE_CACHE_DB は空でない絶対パスで指定してください");
  }
  return {
    path: configuredPath ?? defaultPath,
    ttlsMs: { ...DEFAULT_DLSITE_CACHE_TTLS_MS },
    maxTransferBytes: DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES,
    maxExpandedBytes: DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES,
  };
}

export function normalizeDlsiteProductCode(code: string): {
  productCode: string;
  store: DlsiteStore;
} {
  const productCode = code.trim().toUpperCase();
  const match = RJ_CODE_PATTERN.exec(productCode);
  if (!match) throw new Error(`DLsite product_codeの形式が不正です: ${code}`);
  return { productCode, store: match[1] === "RJ" ? "maniax" : "pro" };
}

function normalizeKey(key: DlsiteCacheKey): NormalizedKey {
  const { productCode, store } = normalizeDlsiteProductCode(key.productCode);
  const representation = key.representation ?? DLSITE_CACHE_REPRESENTATION;
  if (!representation) throw new Error("キャッシュキーの名前空間は空にできません");
  return { store, productCode, representation };
}

/**
 * 入力の検証契約。transferSizeとexpandedSizeは意図的に分ける。
 * 現在のHTML保存は展開済みbodyを受け取る。
 */
export function validateDlsiteHtmlInput(
  input: DlsiteHtmlInputMetadata,
  maxTransferBytes: number,
  maxExpandedBytes: number,
): void {
  if (!/^text\/html(?:\s*;|$)/i.test(input.contentType)) {
    throw new Error(`DLsite HTMLのContent-Typeが不正です: ${input.contentType}`);
  }
  requireNonNegativeSafeInteger(input.expandedSize, "DLsite HTMLの展開サイズ");
  if (input.transferSize !== undefined) {
    requireNonNegativeSafeInteger(input.transferSize, "DLsite HTMLの転送サイズ");
    if (input.transferSize > maxTransferBytes) {
      throw new Error(`DLsite HTMLの転送サイズが上限を超えました: ${input.transferSize}`);
    }
  }
  if (input.expandedSize > maxExpandedBytes) {
    throw new Error(`DLsite HTMLの展開サイズが上限を超えました: ${input.expandedSize}`);
  }
}

export class DlsiteCache {
  private readonly sqlite: Database;
  private readonly path: string;
  private readonly ttlsMs: Record<DlsiteCacheOutcome, number>;
  private readonly maxTransferBytes: number;
  private readonly maxExpandedBytes: number;
  private readonly clock: () => number;

  constructor(options: DlsiteCacheOptions) {
    if (options.path === DLSITE_CACHE_MEMORY_PATH) {
      this.path = DLSITE_CACHE_MEMORY_PATH;
    } else {
      this.path = resolve(options.path);
      mkdirSync(dirname(this.path), { recursive: true });
    }
    this.sqlite = new Database(this.path, { create: true });
    applySqliteBusyTimeout(this.sqlite);
    this.sqlite.exec("PRAGMA journal_mode = WAL");
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS dlsite_html_snapshots (
        store TEXT NOT NULL CHECK(store IN ('maniax', 'pro')),
        product_code TEXT NOT NULL,
        representation TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK(outcome IN ('ok', 'parse_error')),
        content_fetched_at INTEGER NOT NULL,
        content_expires_at INTEGER NOT NULL,
        html_gzip BLOB NOT NULL,
        html_size INTEGER NOT NULL,
        PRIMARY KEY (store, product_code, representation)
      );
      CREATE INDEX IF NOT EXISTS dlsite_html_snapshots_expires_at
        ON dlsite_html_snapshots(content_expires_at);
      CREATE TABLE IF NOT EXISTS dlsite_fetch_failures (
        store TEXT NOT NULL CHECK(store IN ('maniax', 'pro')),
        product_code TEXT NOT NULL,
        representation TEXT NOT NULL,
        failure_kind TEXT NOT NULL CHECK(failure_kind IN ('not_found', 'error')),
        attempted_at INTEGER NOT NULL,
        failure_expires_at INTEGER NOT NULL,
        PRIMARY KEY (store, product_code, representation)
      );
      CREATE INDEX IF NOT EXISTS dlsite_fetch_failures_expires_at
        ON dlsite_fetch_failures(failure_expires_at);
      CREATE TABLE IF NOT EXISTS dlsite_parsed_products (
        store TEXT NOT NULL CHECK(store IN ('maniax', 'pro')),
        product_code TEXT NOT NULL,
        representation TEXT NOT NULL,
        content_fetched_at INTEGER NOT NULL,
        parser_version INTEGER NOT NULL,
        info_json TEXT NOT NULL,
        PRIMARY KEY (store, product_code, representation)
      );
      CREATE TABLE IF NOT EXISTS dlsite_cover_entries (
        cache_key TEXT PRIMARY KEY,
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

  /** 解決済みのパス・TTLをスキャンWorker等の別コンシューマーへ渡すための構成。 */
  get config(): DlsiteCacheConfig {
    return {
      path: this.path,
      ttlsMs: { ...this.ttlsMs },
      maxTransferBytes: this.maxTransferBytes,
      maxExpandedBytes: this.maxExpandedBytes,
    };
  }

  /** HTTP成功時（2xxでパースできてもできなくても）に呼ぶ。失敗記録は消す。
   *  解析できたときは解析結果（parsed）もsnapshotと同じ書き込みで保存する。 */
  recordSuccess(
    input: DlsiteCacheKey & {
      outcome: DlsiteHtmlOutcome;
      contentType: string;
      html: string | Uint8Array;
      transferSize?: number;
      parsed?: { parserVersion: number; info: DlsiteWorkInfo };
    },
  ): void {
    const key = normalizeKey(input);
    const bytes = typeof input.html === "string" ? Buffer.from(input.html) : input.html;
    validateDlsiteHtmlInput(
      {
        contentType: input.contentType,
        transferSize: input.transferSize,
        expandedSize: bytes.byteLength,
      },
      this.maxTransferBytes,
      this.maxExpandedBytes,
    );
    const fetchedAt = this.clock();
    requirePositiveSafeInteger(fetchedAt, "clockの返り値");
    const expiresAt = fetchedAt + this.ttlsMs[input.outcome];
    requirePositiveSafeInteger(expiresAt, "fetched_at + TTL");
    const htmlGzip = gzipSync(bytes);
    const write = this.sqlite.transaction(() => {
      this.sqlite
        .query(
          `INSERT INTO dlsite_html_snapshots
            (store, product_code, representation, outcome, content_fetched_at,
             content_expires_at, html_gzip, html_size)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(store, product_code, representation) DO UPDATE SET
             outcome = excluded.outcome, content_fetched_at = excluded.content_fetched_at,
             content_expires_at = excluded.content_expires_at, html_gzip = excluded.html_gzip,
             html_size = excluded.html_size`,
        )
        .run(
          key.store,
          key.productCode,
          key.representation,
          input.outcome,
          fetchedAt,
          expiresAt,
          htmlGzip,
          bytes.byteLength,
        );
      this.sqlite
        .query(
          `DELETE FROM dlsite_fetch_failures
           WHERE store = ? AND product_code = ? AND representation = ?`,
        )
        .run(key.store, key.productCode, key.representation);
      this.sqlite
        .query(
          `DELETE FROM dlsite_parsed_products
           WHERE store = ? AND product_code = ? AND representation = ?`,
        )
        .run(key.store, key.productCode, key.representation);
      if (input.parsed) this.writeParsedRow(key, fetchedAt, input.parsed);
    });
    write();
  }

  private writeParsedRow(
    key: NormalizedKey,
    contentFetchedAt: number,
    parsed: { parserVersion: number; info: DlsiteWorkInfo },
  ): void {
    this.sqlite
      .query(
        `INSERT INTO dlsite_parsed_products
          (store, product_code, representation, content_fetched_at, parser_version, info_json)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(store, product_code, representation) DO UPDATE SET
           content_fetched_at = excluded.content_fetched_at,
           parser_version = excluded.parser_version, info_json = excluded.info_json`,
      )
      .run(
        key.store,
        key.productCode,
        key.representation,
        contentFetchedAt,
        parsed.parserVersion,
        JSON.stringify(parsed.info),
      );
  }

  /** 読み直して得た解析結果を、対応するsnapshotの取得時刻つきで保存する。 */
  writeParsed(
    keyInput: DlsiteCacheKey,
    contentFetchedAt: number,
    parsed: { parserVersion: number; info: DlsiteWorkInfo },
  ): void {
    this.writeParsedRow(normalizeKey(keyInput), contentFetchedAt, parsed);
  }

  /** 保存済みの解析結果。TTLは見ない（有効性は呼び出し側がresolveHeadのfetchedAtと突き合わせる）。 */
  readParsed(keyInput: DlsiteCacheKey): DlsiteParsedEntry | null {
    const key = normalizeKey(keyInput);
    const row = this.sqlite
      .query(
        `SELECT content_fetched_at, parser_version, info_json FROM dlsite_parsed_products
         WHERE store = ? AND product_code = ? AND representation = ?`,
      )
      .get(key.store, key.productCode, key.representation) as ParsedRow | null;
    if (!row) return null;
    let raw: unknown;
    try {
      raw = JSON.parse(row.info_json);
    } catch {
      return null;
    }
    const info = dlsiteWorkInfoSchema.safeParse(raw);
    if (!info.success) return null;
    return {
      contentFetchedAt: row.content_fetched_at,
      parserVersion: row.parser_version,
      info: info.data,
    };
  }

  /** HTTP失敗時に呼ぶ。既存のHTML snapshotは診断用に残したまま触らない。 */
  recordFailure(input: DlsiteCacheKey & { outcome: DlsiteFailureOutcome }): void {
    const key = normalizeKey(input);
    const attemptedAt = this.clock();
    requirePositiveSafeInteger(attemptedAt, "clockの返り値");
    const expiresAt = attemptedAt + this.ttlsMs[input.outcome];
    requirePositiveSafeInteger(expiresAt, "attempted_at + TTL");
    this.sqlite
      .query(
        `INSERT INTO dlsite_fetch_failures
          (store, product_code, representation, failure_kind, attempted_at, failure_expires_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(store, product_code, representation) DO UPDATE SET
           failure_kind = excluded.failure_kind, attempted_at = excluded.attempted_at,
           failure_expires_at = excluded.failure_expires_at`,
      )
      .run(key.store, key.productCode, key.representation, input.outcome, attemptedAt, expiresAt);
  }

  private readFailure(key: NormalizedKey): FailureRow | null {
    return this.sqlite
      .query(
        `SELECT failure_kind, attempted_at, failure_expires_at FROM dlsite_fetch_failures
         WHERE store = ? AND product_code = ? AND representation = ?`,
      )
      .get(key.store, key.productCode, key.representation) as FailureRow | null;
  }

  private readSnapshotMeta(key: NormalizedKey): SnapshotMetaRow | null {
    return this.sqlite
      .query(
        `SELECT outcome, content_fetched_at, content_expires_at
         FROM dlsite_html_snapshots
         WHERE store = ? AND product_code = ? AND representation = ?`,
      )
      .get(key.store, key.productCode, key.representation) as SnapshotMetaRow | null;
  }

  private readSnapshotBody(key: NormalizedKey): SnapshotBodyRow | null {
    return this.sqlite
      .query(
        `SELECT html_gzip, html_size FROM dlsite_html_snapshots
         WHERE store = ? AND product_code = ? AND representation = ?`,
      )
      .get(key.store, key.productCode, key.representation) as SnapshotBodyRow | null;
  }

  private decompressHtml(row: SnapshotBodyRow): string {
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
    return bytes.toString("utf8");
  }

  /**
   * 通常取得の判断をメタ行の読み取りだけで返す。有効な失敗記録があればそれを、
   * なければTTL内のHTML snapshotを、それもなければmissを返す。
   */
  resolveHead(keyInput: DlsiteCacheKey): DlsiteCacheResolutionHead {
    const key = normalizeKey(keyInput);
    const now = this.clock();
    const failure = this.readFailure(key);
    if (failure && failure.failure_expires_at > now) {
      return {
        kind: "failure",
        outcome: failure.failure_kind,
        attemptedAt: failure.attempted_at,
        expiresAt: failure.failure_expires_at,
      };
    }
    const meta = this.readSnapshotMeta(key);
    if (!meta) return { kind: "miss", reason: "not_cached" };
    if (meta.content_expires_at <= now) return { kind: "miss", reason: "ttl_expired" };
    return {
      kind: "html",
      outcome: meta.outcome,
      fetchedAt: meta.content_fetched_at,
      expiresAt: meta.content_expires_at,
    };
  }

  /** resolveHeadの判断に、hit確定後のgzip本文の展開を足す。 */
  resolve(keyInput: DlsiteCacheKey): DlsiteCacheResolution {
    const head = this.resolveHead(keyInput);
    if (head.kind !== "html") return head;
    const body = this.readSnapshotBody(normalizeKey(keyInput));
    if (!body) return { kind: "miss", reason: "snapshot_body_missing" };
    return { ...head, html: this.decompressHtml(body) };
  }

  /** cover URLの正規化済み表現を含むキー。画像は圧縮しない。 */
  static coverKey(normalizedUrl: string): string {
    return createHash("sha256").update(normalizedUrl).digest("hex");
  }

  /** カバーの有無と版（fetched_at）。本文は読まない。 */
  coverVersionByKey(coverKey: string): number | null {
    const row = this.sqlite
      .query("SELECT fetched_at FROM dlsite_cover_entries WHERE cache_key = ?")
      .get(coverKey) as { fetched_at: number } | null;
    return row ? row.fetched_at : null;
  }

  getCoverByKey(coverKey: string): { body: Uint8Array; fetchedAt: number } | null {
    const row = this.sqlite
      .query("SELECT body, fetched_at FROM dlsite_cover_entries WHERE cache_key = ?")
      .get(coverKey) as { body: Uint8Array; fetched_at: number } | null;
    return row ? { body: new Uint8Array(row.body), fetchedAt: row.fetched_at } : null;
  }

  getCover(normalizedUrl: string): { body: Uint8Array } | null {
    const row = this.sqlite
      .query("SELECT body FROM dlsite_cover_entries WHERE cache_key = ?")
      .get(DlsiteCache.coverKey(normalizedUrl)) as { body: Uint8Array } | null;
    return row ? { body: new Uint8Array(row.body) } : null;
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
        `INSERT INTO dlsite_cover_entries (cache_key, body, fetched_at)
         VALUES (?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at`,
      )
      .run(DlsiteCache.coverKey(normalizedUrl), body, this.clock());
  }

  /** cleanup 前の HTML snapshot を読み出す（診断用。TTL は見ない）。 */
  exportHtml(keyInput: DlsiteCacheKey): string {
    const key = normalizeKey(keyInput);
    const body = this.readSnapshotBody(key);
    if (!body) {
      throw new Error("DLsiteキャッシュにHTML snapshotがありません");
    }
    return this.decompressHtml(body);
  }

  /** 現行representationのHTML snapshotを持つproduct codeを列挙する（TTLは見ない）。 */
  listSnapshotProductCodes(): string[] {
    const rows = this.sqlite
      .query(
        `SELECT product_code FROM dlsite_html_snapshots
         WHERE representation = ? ORDER BY product_code`,
      )
      .all(DLSITE_CACHE_REPRESENTATION) as { product_code: string }[];
    return rows.map((row) => row.product_code);
  }

  /** gzip圧縮されたままのHTML snapshotを取り出す（アーカイブ用。TTLは見ない）。 */
  exportHtmlGzip(keyInput: DlsiteCacheKey): Uint8Array {
    const key = normalizeKey(keyInput);
    const body = this.readSnapshotBody(key);
    if (!body) {
      throw new Error("DLsiteキャッシュにHTML snapshotがありません");
    }
    return body.html_gzip;
  }

  cleanupExpired(): number {
    const now = this.clock();
    let deleted = 0;
    deleted += this.sqlite
      .query("DELETE FROM dlsite_html_snapshots WHERE content_expires_at <= ?")
      .run(now).changes;
    deleted += this.sqlite
      .query("DELETE FROM dlsite_fetch_failures WHERE failure_expires_at <= ?")
      .run(now).changes;
    deleted += this.sqlite
      .query(
        `DELETE FROM dlsite_parsed_products WHERE NOT EXISTS (
           SELECT 1 FROM dlsite_html_snapshots s
           WHERE s.store = dlsite_parsed_products.store
             AND s.product_code = dlsite_parsed_products.product_code
             AND s.representation = dlsite_parsed_products.representation)`,
      )
      .run().changes;
    return deleted;
  }

  status(): { entries: number; bytes: number } {
    const snapshots = (
      this.sqlite.query("SELECT COUNT(*) AS count FROM dlsite_html_snapshots").get() as {
        count: number;
      }
    ).count;
    const failures = (
      this.sqlite.query("SELECT COUNT(*) AS count FROM dlsite_fetch_failures").get() as {
        count: number;
      }
    ).count;
    // WAL と SHM を含め、運用時に実際に占有しているファイルサイズを返す。
    const bytes = ["", "-wal", "-shm"].reduce((total, suffix) => {
      const path = `${this.sqlite.filename}${suffix}`;
      return total + (existsSync(path) ? statSync(path).size : 0);
    }, 0);
    return { entries: snapshots + failures, bytes };
  }

  close(): void {
    this.sqlite.close();
  }
}
