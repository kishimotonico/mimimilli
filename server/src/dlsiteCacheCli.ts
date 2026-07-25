import { closeSync, constants, fstatSync, openSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import { parseDlsiteHtml } from "./adapters/real/dlsite.ts";
import {
  DlsiteCache,
  normalizeDlsiteProductCode,
  resolveDlsiteCacheConfig,
  type DlsiteCacheOptions,
} from "./adapters/real/dlsiteCache.ts";
import { resolveDataPaths } from "./adapters/real/dataRoot.ts";

function readImportHtml(file: string, maxTransferBytes: number): Buffer {
  if (extname(file).toLowerCase() !== ".html") {
    throw new Error("importできるのは .html ファイルだけです");
  }
  let fd: number | undefined;
  try {
    // パス検査後にsymlinkへ差し替えられないよう、O_NOFOLLOWで開いた同じfdを検査・読込する。
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
    if (bytes.subarray(0, 2).equals(Buffer.from([0x1f, 0x8b]))) {
      throw new Error("gzip入力はimportできません");
    }
    return bytes;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ELOOP") {
      throw new Error("import対象はsymlinkではない通常ファイルにしてください", { cause: error });
    }
    throw error;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export function runDlsiteCacheCli(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  overrides: Pick<DlsiteCacheOptions, "clock" | "ttlsMs"> = {},
): string {
  const config = resolveDlsiteCacheConfig(resolveDataPaths(env).dlsiteCacheDb, env);
  const cache = new DlsiteCache({ ...config, ...overrides });
  try {
    const [command, ...args] = argv;
    if (command === "status" && args.length === 0) return JSON.stringify(cache.status());
    if (command === "cleanup" && args.length === 0)
      return JSON.stringify({ deleted: cache.cleanupExpired() });
    if (
      command === "import" &&
      args.length === 4 &&
      args[0] === "--product-code" &&
      args[2] === "--file"
    ) {
      const productCode = normalizeDlsiteProductCode(args[1]).productCode;
      const bytes = readImportHtml(args[3], config.maxTransferBytes);
      const html = bytes.toString("utf8");
      const parsed = parseDlsiteHtml(html, productCode);
      cache.putHtml({
        productCode,
        outcome: parsed.ok ? "ok" : "parse_error",
        contentType: "text/html; charset=utf-8",
        html: bytes,
      });
      return JSON.stringify({ productCode, outcome: parsed.ok ? "ok" : "parse_error" });
    }
    throw new Error(
      "usage: dlsite-cache <status|cleanup|import --product-code <RJ|VJ> --file <path.html>>",
    );
  } finally {
    cache.close();
  }
}

if (import.meta.main) console.log(runDlsiteCacheCli(Bun.argv.slice(2)));
