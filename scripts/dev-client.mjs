#!/usr/bin/env node
// client dev 起動ラッパー。
//
// 同じ worktree の API サーバー（portless サービス）の URL を portless から解決し、
// MIMIMILLI_BACKEND_URL として vite へ渡す。vite.config.ts は環境変数だけを見る。
// portless は vite を直接実行するときだけ --port 等を注入するため、ラッパー経由では自前で渡す。
// portless run 配下（client/ をcwd）から呼ぶこと。
import { execFileSync } from "node:child_process";
import { spawnAndForward } from "./lib/spawnAndForward.mjs";

const backendService = process.env.MIMIMILLI_BACKEND_SERVICE ?? "api.mimi";

// Windows の portless は node_modules/.bin のバッチシム（.CMD）なので shell 経由が必須。
// 引数は静的な文字列のみのため shell 経由でもエスケープの懸念はない。
const backendUrl = execFileSync("portless", ["get", backendService], {
  encoding: "utf8",
  shell: process.platform === "win32",
}).trim();

const { PORT, HOST } = process.env;
if (!PORT) {
  throw new Error("PORT が未設定です。portless run 配下で起動してください");
}

spawnAndForward("vite", ["--host", HOST ?? "127.0.0.1", "--port", PORT, "--strictPort"], {
  env: { ...process.env, MIMIMILLI_BACKEND_URL: backendUrl },
});
