import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { parseDlsiteHtml } from "./adapters/real/dlsite.ts";
import {
  DlsiteCache,
  normalizeDlsiteProductCode,
  resolveDlsiteCacheConfig,
  type DlsiteCacheOptions,
} from "./adapters/real/dlsiteCache.ts";
import { resolveDataPaths } from "./adapters/real/dataRoot.ts";

const GZIP_MAGIC = Buffer.from([0x1f, 0x8b]);
// ディレクトリimportの命名規約: <RJ|VJ番号>.html または <RJ|VJ番号>.html.gz（docs/dlsite.md参照）
const IMPORT_FILE_EXTENSION_PATTERN = /\.html(\.gz)?$/i;
const IMPORT_FILE_NAME_PATTERN = /^([A-Za-z]{2}\d{6,8})\.html(\.gz)?$/i;

interface ImportSuccess {
  file: string;
  productCode: string;
  outcome: "ok" | "parse_error";
}

interface ImportFailure {
  file: string;
  error: string;
}

/** symlinkへの差し替えを防ぐため、開いた同じfdを検査・読込する。gzipはmagic byteで判定する。 */
function readImportFile(file: string, maxTransferBytes: number, maxExpandedBytes: number): Buffer {
  let fd: number | undefined;
  try {
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const fileStat = fstatSync(fd);
    if (!fileStat.isFile()) throw new Error("import対象は通常ファイルにしてください");
    if (fileStat.size > maxTransferBytes) {
      throw new Error(`DLsite HTMLの転送サイズが上限を超えました: ${fileStat.size}`);
    }
    const bytes = readFileSync(fd);
    if (bytes.byteLength > maxTransferBytes) {
      throw new Error(`DLsite HTMLの転送サイズが上限を超えました: ${bytes.byteLength}`);
    }
    if (!bytes.subarray(0, 2).equals(GZIP_MAGIC)) {
      if (bytes.byteLength > maxExpandedBytes) {
        throw new Error(`DLsite HTMLの展開サイズが上限を超えました: ${bytes.byteLength}`);
      }
      return bytes;
    }
    let expanded: Buffer;
    try {
      expanded = gunzipSync(bytes, { maxOutputLength: maxExpandedBytes });
    } catch (error) {
      throw new Error("DLsite HTMLのgzip展開に失敗しました（上限超過の可能性があります）", {
        cause: error,
      });
    }
    if (expanded.byteLength > maxExpandedBytes) {
      throw new Error(`DLsite HTMLの展開サイズが上限を超えました: ${expanded.byteLength}`);
    }
    return expanded;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ELOOP") {
      throw new Error("import対象はsymlinkではない通常ファイルにしてください", { cause: error });
    }
    throw error;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function importOne(
  cache: DlsiteCache,
  productCode: string,
  bytes: Buffer,
): { outcome: "ok" | "parse_error" } {
  const parsed = parseDlsiteHtml(bytes.toString("utf8"), productCode);
  cache.recordSuccess({
    productCode,
    outcome: parsed.ok ? "ok" : "parse_error",
    contentType: "text/html; charset=utf-8",
    html: bytes,
  });
  return { outcome: parsed.ok ? "ok" : "parse_error" };
}

function deriveProductCodeFromFileName(name: string): string {
  const match = IMPORT_FILE_NAME_PATTERN.exec(name);
  if (!match) {
    throw new Error(
      `ファイル名からproduct codeを決定できません（<RJ|VJ番号>.html または .html.gz にしてください）: ${name}`,
    );
  }
  const code = match[1];
  if (!code) {
    throw new Error(
      `ファイル名からproduct codeを決定できません（<RJ|VJ番号>.html または .html.gz にしてください）: ${name}`,
    );
  }
  return normalizeDlsiteProductCode(code).productCode;
}

function importDirectory(
  dir: string,
  cache: DlsiteCache,
  maxTransferBytes: number,
  maxExpandedBytes: number,
): { succeeded: ImportSuccess[]; failed: ImportFailure[] } {
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && IMPORT_FILE_EXTENSION_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const succeeded: ImportSuccess[] = [];
  const failed: ImportFailure[] = [];
  for (const name of names) {
    try {
      const productCode = deriveProductCodeFromFileName(name);
      const bytes = readImportFile(join(dir, name), maxTransferBytes, maxExpandedBytes);
      const { outcome } = importOne(cache, productCode, bytes);
      succeeded.push({ file: name, productCode, outcome });
    } catch (error) {
      failed.push({ file: name, error: (error as Error).message });
    }
  }
  return { succeeded, failed };
}

const USAGE =
  "usage: dlsite-cache <status|cleanup" +
  "|export --product-code <RJ|VJ> --file <path.html>" +
  "|import --product-code <RJ|VJ> --file <path.html[.gz]>" +
  "|import --dir <path>>";

export function runDlsiteCacheCli(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  overrides: Pick<
    DlsiteCacheOptions,
    "clock" | "ttlsMs" | "maxTransferBytes" | "maxExpandedBytes"
  > = {},
): string {
  const config = resolveDlsiteCacheConfig(resolveDataPaths(env).dlsiteCacheDb, env);
  const cache = new DlsiteCache({ ...config, ...overrides });
  try {
    const [command, ...args] = argv;
    if (command === "status" && args.length === 0) return JSON.stringify(cache.status());
    if (command === "cleanup" && args.length === 0)
      return JSON.stringify({ deleted: cache.cleanupExpired() });
    if (
      command === "export" &&
      args.length === 4 &&
      args[0] === "--product-code" &&
      args[2] === "--file"
    ) {
      const productCodeArg = args[1];
      const fileArg = args[3];
      if (productCodeArg === undefined || fileArg === undefined) throw new Error(USAGE);
      const productCode = normalizeDlsiteProductCode(productCodeArg).productCode;
      const html = cache.exportHtml({ productCode });
      writeFileSync(fileArg, html, "utf8");
      return JSON.stringify({ productCode, bytes: Buffer.byteLength(html, "utf8") });
    }
    if (command === "import" && args.length === 2 && args[0] === "--dir") {
      const dirArg = args[1];
      if (dirArg === undefined) throw new Error(USAGE);
      const result = importDirectory(
        dirArg,
        cache,
        config.maxTransferBytes,
        config.maxExpandedBytes,
      );
      return JSON.stringify({
        succeeded: result.succeeded.length,
        failed: result.failed.length,
        failures: result.failed,
      });
    }
    if (
      command === "import" &&
      args.length === 4 &&
      args[0] === "--product-code" &&
      args[2] === "--file"
    ) {
      const productCodeArg = args[1];
      const fileArg = args[3];
      if (productCodeArg === undefined || fileArg === undefined) throw new Error(USAGE);
      const productCode = normalizeDlsiteProductCode(productCodeArg).productCode;
      const bytes = readImportFile(fileArg, config.maxTransferBytes, config.maxExpandedBytes);
      const { outcome } = importOne(cache, productCode, bytes);
      return JSON.stringify({ productCode, outcome });
    }
    throw new Error(USAGE);
  } finally {
    cache.close();
  }
}

if (import.meta.main) console.log(runDlsiteCacheCli(Bun.argv.slice(2)));
