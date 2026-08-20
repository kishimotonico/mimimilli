#!/usr/bin/env node
// dev:real 起動ラッパー。
//
// linked worktree（git worktree add で作られた作業ディレクトリ）から real アダプタを起動すると、
// MIMIMILLI_DATA_DIR が未設定の場合にメインの作業ディレクトリと同じ本番データディレクトリ
// （server/src/adapters/real/dataRoot.ts の resolveDataPaths が返す既定パス）を共有してしまう。
// このスクリプトは pnpm から呼ばれる起動コマンドの前段に立ち、linked worktree を検出したときだけ
// worktree 専用の MIMIMILLI_DATA_DIR を自動設定する。git を意識するのはこの層のみで、
// アプリ本体（dataRoot.ts）は環境変数の有無しか見ない。
//
// 使い方: node scripts/dev-real.mjs -- <実行したいコマンド...>
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { spawnAndForward } from "./lib/spawnAndForward.mjs";

function parseArgs(argv) {
  const sep = argv.indexOf("--");
  if (sep === -1 || sep === argv.length - 1) {
    throw new Error("使い方: node scripts/dev-real.mjs -- <実行したいコマンド...>");
  }
  return argv.slice(sep + 1);
}

/** dataRoot.ts の resolveDataPaths と同じ規則で本番データルートを決める。 */
function resolveProductionRoot(env, platform) {
  if (platform === "win32") {
    if (!env.LOCALAPPDATA) {
      throw new Error("LOCALAPPDATAが未設定のためMimimilliのデータルートを決定できません");
    }
    return path.join(env.LOCALAPPDATA, "mimimilli");
  }
  const base = env.XDG_DATA_HOME || path.join(homedir(), ".local", "share");
  return path.join(path.isAbsolute(base) ? base : path.resolve(base), "mimimilli");
}

/**
 * git worktree の状態を調べる。メインの作業ディレクトリなら git-dir と git-common-dir が一致し、
 * linked worktree なら git-dir が `<common-dir>/worktrees/<name>` を指すため両者が異なる。
 */
function detectWorktree() {
  const result = spawnSync(
    "git",
    ["rev-parse", "--path-format=absolute", "--show-toplevel", "--git-dir", "--git-common-dir"],
    { encoding: "utf8" },
  );
  if (result.error) {
    throw new Error(`gitコマンドの実行に失敗しました: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`git rev-parse が失敗しました: ${result.stderr.trim()}`);
  }
  const [toplevel, gitDir, gitCommonDir] = result.stdout.trim().split("\n");
  const isLinkedWorktree = path.resolve(gitDir) !== path.resolve(gitCommonDir);
  return { toplevel, isLinkedWorktree };
}

function resolveExtraEnv(env, platform) {
  if (env.MIMIMILLI_DATA_DIR) {
    console.log(`[dev-real] MIMIMILLI_DATA_DIR が明示設定されています: ${env.MIMIMILLI_DATA_DIR}`);
    return {};
  }

  const { toplevel, isLinkedWorktree } = detectWorktree();
  if (!isLinkedWorktree) {
    console.log("[dev-real] メインの作業ディレクトリです。本番データディレクトリを使用します。");
    return {};
  }

  const productionRoot = resolveProductionRoot(env, platform);
  const pathHash = createHash("sha256").update(toplevel).digest("hex").slice(0, 8);
  const dirName = `${path.basename(toplevel)}-${pathHash}`;
  const dataDir = path.join(path.dirname(productionRoot), "mimimilli-worktrees", dirName);
  console.log(
    `[dev-real] linked worktree を検出しました（${toplevel}）。専用データディレクトリを使用します: MIMIMILLI_DATA_DIR=${dataDir}`,
  );
  return { MIMIMILLI_DATA_DIR: dataDir };
}

function main() {
  const command = parseArgs(process.argv);
  const extraEnv = resolveExtraEnv(process.env, process.platform);
  const env = { ...process.env, ...extraEnv };

  spawnAndForward(command[0], command.slice(1), { env });
}

main();
