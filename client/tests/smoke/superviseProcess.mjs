// smokeサーバーの親（Playwright worker）が異常終了しても子を残さないための監督プロセス。
// 親とのstdinパイプが閉じた（親が消えた）ときだけ、自身が先頭のプロセスグループごとSIGKILLで終了させる。
// SIGTERM/SIGINTは子へ転送し、子のgraceful shutdownを待ってから抜ける。
import { spawn } from "node:child_process";

const [command, ...args] = process.argv.slice(2);
const child = spawn(command, args, { stdio: ["ignore", "inherit", "inherit"] });

function killGroup() {
  try {
    process.kill(-process.pid, "SIGKILL");
  } catch {
    process.exit(1);
  }
}

process.stdin.on("close", killGroup);
process.stdin.resume();
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 1));
