#!/usr/bin/env node
// ビジュアルテスト実行前に 127.0.0.1 への TCP 疎通を短いタイムアウトで確認する。
//
// WSL2 の mirrored networking では loopback の未使用ポートへの SYN が黙って
// 捨てられることがあり、Playwright のポートチェック（タイムアウトなし）が
// TCP 再送タイムアウト（約2分強）まで待たされる。ここで短いタイムアウト付きで
// 先に検知し、wsl --shutdown での復旧を案内する。

import net from "node:net";

const port = Number(process.env.VISUAL_PORT ?? 4175);
const timeoutMs = 2000;

function probe(targetPort, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.connect(targetPort, "127.0.0.1");
    const startedAt = Date.now();
    const finish = (outcome) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve({ outcome, elapsedMs: Date.now() - startedAt });
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish("connected"));
    socket.once("error", () => finish("refused"));
    socket.once("timeout", () => finish("blackholed"));
  });
}

const { outcome, elapsedMs } = await probe(port, timeoutMs);

if (outcome === "blackholed") {
  console.error(
    `[check-loopback-health] 127.0.0.1:${port} への接続確認が ${timeoutMs}ms 経っても応答しません。\n` +
      "WSL2 の mirrored networking がループバック接続を一時的にブラックホール化している可能性があります。\n" +
      "この状態では Playwright の webServer 起動前チェックが Linux の TCP 再送タイムアウト" +
      "（約2分強）まで無応答になり、テスト全体が非常に遅くなります。\n" +
      "Windows 側のターミナルで `wsl --shutdown` を実行し、WSL を再起動してから再試行してください。",
  );
  process.exit(1);
}

console.log(`[check-loopback-health] 127.0.0.1:${port} 応答OK (${outcome}, ${elapsedMs}ms)`);
