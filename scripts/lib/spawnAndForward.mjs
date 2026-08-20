// cross-spawn で子プロセスを起動し、シグナル転送と終了コードの伝播を行う共通ヘルパー。
// Node組み込みspawnをshell:true+args配列で使うとWindowsでDEP0190が出るため、
// このリポジトリでは常にこの関数（cross-spawn経由）を使う。
import crossSpawn from "cross-spawn";

export function spawnAndForward(command, args, options = {}) {
  const child = crossSpawn(command, args, { stdio: "inherit", ...options });

  const signalHandlers = new Map();
  for (const signal of ["SIGINT", "SIGTERM"]) {
    const handler = () => child.kill(signal);
    signalHandlers.set(signal, handler);
    process.on(signal, handler);
  }

  child.on("exit", (code, signal) => {
    if (signal) {
      for (const [sig, handler] of signalHandlers) {
        process.removeListener(sig, handler);
      }
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });

  child.on("error", (err) => {
    console.error(`コマンド起動に失敗しました: ${err.message}`);
    process.exit(1);
  });

  return child;
}
