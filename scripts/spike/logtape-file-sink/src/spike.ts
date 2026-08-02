/**
 * LogTape file sink + Bun compile spike.
 *
 * Usage:
 *   bun run src/spike.ts [--mode normal|exit-immediate|sigint-loop] [--log-path <path>]
 */
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { getFileSink } from "@logtape/file";
import {
  configure,
  dispose,
  getConsoleSink,
  getLogger,
  jsonLinesFormatter,
} from "@logtape/logtape";

function getSpikeRoot(): string {
  // bun build --compile では import.meta.dir が /$bunfs 内を指すため、実行ファイルのディレクトリを使う
  if (import.meta.dir.startsWith("/$bunfs")) {
    return dirname(resolve(process.argv[0] ?? "."));
  }
  return resolve(import.meta.dir, "..");
}

const SPIKE_ROOT = getSpikeRoot();

function parseArgs() {
  const args = process.argv.slice(2);
  let mode: "normal" | "exit-immediate" | "sigint-loop" = "normal";
  let logPath = join(SPIKE_ROOT, "logs", "test.jsonl");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--mode" && args[i + 1]) {
      mode = args[++i] as typeof mode;
    } else if (args[i] === "--log-path" && args[i + 1]) {
      logPath = args[++i]!;
    }
  }
  return { mode, logPath };
}

async function setupLogging(logPath: string) {
  mkdirSync(dirname(logPath), { recursive: true });

  await configure({
    sinks: {
      console: getConsoleSink(),
      file: getFileSink(logPath, {
        formatter: jsonLinesFormatter,
        bufferSize: 8192,
        flushInterval: 5000,
      }),
    },
    loggers: [
      {
        category: "spike",
        sinks: ["console", "file"],
        lowestLevel: "debug",
      },
    ],
  });

  return getLogger("spike").with({ component: "logtape-spike", spikeRoot: SPIKE_ROOT });
}

function emitLogs(logger: ReturnType<typeof getLogger>) {
  const levels = ["info", "warn", "error"] as const;
  const messages = [
    "処理を開始しました",
    "DLsite作品のメタデータを取得中",
    "パースに失敗しました。再試行します",
    "同期ジョブが完了しました",
    "データベース接続がタイムアウトしました",
  ];

  for (let i = 0; i < 30; i++) {
    const level = levels[i % levels.length]!;
    const workId = `RJ${String(100000 + (i % 50)).padStart(6, "0")}`;
    const ctx = {
      workId,
      batchId: `batch-${Math.floor(i / 10)}`,
      seq: i,
      elapsedMs: i * 137,
    };

    const msg = `[${i}] ${messages[i % messages.length]}`;

    if (level === "info") logger.info(msg, ctx);
    else if (level === "warn") logger.warn(msg, ctx);
    else logger.error(msg, ctx);
  }
}

async function main() {
  const { mode, logPath } = parseArgs();
  const logger = await setupLogging(logPath);

  console.error(`[spike] mode=${mode} logPath=${logPath} cwd=${process.cwd()}`);

  if (mode === "sigint-loop") {
    let count = 0;
    const timer = setInterval(() => {
      logger.info(`ループ中のログ #${count}`, {
        workId: `RJ${String(200000 + count).padStart(6, "0")}`,
        iteration: count,
      });
      count++;
    }, 100);

    process.on("SIGINT", async () => {
      clearInterval(timer);
      console.error(`[spike] SIGINT received after ${count} iterations, disposing...`);
      await dispose();
      process.exit(130);
    });

    await new Promise(() => {});
    return;
  }

  emitLogs(logger);

  if (mode === "exit-immediate") {
    // dispose() を呼ばずに終了し、バッファ flush の有無を検証する
    process.exit(0);
  }

  await dispose();
}

main().catch((err) => {
  console.error("[spike] fatal:", err);
  process.exit(1);
});
