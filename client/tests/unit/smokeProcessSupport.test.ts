import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { isGroupAlive, shutdown, withDeadline } from "../smoke/processSupport";

describe("withDeadline", () => {
  it("期限内に終われば結果を返す", async () => {
    await expect(withDeadline(async () => 1, 100, "処理")).resolves.toBe(1);
  });

  it("解決しない処理は期限で label 付きで reject する", async () => {
    await expect(withDeadline(() => new Promise<void>(() => {}), 30, "newPage")).rejects.toThrow(
      "newPage が 30ms の期限内に終わりませんでした",
    );
  });
});

// 先頭（監督役）が子を起こし、子が待受ポートを持つ構成を模す。
const LEADER_SCRIPT = `
const { spawn } = require("node:child_process");
spawn(process.execPath, ["-e", "const s=require('node:net').createServer().listen(0,'127.0.0.1',()=>console.log('PORT='+s.address().port));setInterval(()=>{},1000)"], { stdio: ["ignore", "inherit", "inherit"] });
setInterval(() => {}, 1000);
`;

function readPort(proc: ChildProcess): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    let out = "";
    proc.stdout?.on("data", (chunk: Buffer) => {
      out += chunk.toString();
      const match = /PORT=(\d+)/.exec(out);
      if (match) resolvePromise(Number(match[1]));
    });
    proc.once("exit", () => reject(new Error("ポートを読む前に終了しました")));
  });
}

function canBind(port: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const probe = createServer();
    probe.once("error", () => resolvePromise(false));
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolvePromise(true)));
  });
}

describe.skipIf(process.platform === "win32")("shutdown（プロセスグループ）", () => {
  const leaders: ChildProcess[] = [];
  // テストが途中で失敗しても detached のグループを残さない
  afterEach(() => {
    for (const leader of leaders.splice(0)) {
      try {
        process.kill(-leader.pid!, "SIGKILL");
      } catch {
        // 既に消えている
      }
    }
  });

  function spawnLeader(): ChildProcess {
    const leader = spawn(process.execPath, ["-e", LEADER_SCRIPT], {
      stdio: ["ignore", "pipe", "inherit"],
      detached: true,
    });
    leaders.push(leader);
    return leader;
  }

  it("先頭だけが SIGKILL で消えても、残った子を止めて待受ポートを解放して戻る", async () => {
    const leader = spawnLeader();
    const port = await readPort(leader);
    expect(await canBind(port)).toBe(false);

    process.kill(leader.pid!, "SIGKILL");
    await new Promise((resolvePromise) => leader.once("exit", resolvePromise));
    expect(isGroupAlive(leader)).toBe(true);

    await shutdown(leader, 300);

    expect(isGroupAlive(leader)).toBe(false);
    expect(await canBind(port)).toBe(true);
  }, 15_000);

  it("通常の終了ではグループ全体が消えて戻る", async () => {
    const leader = spawnLeader();
    const port = await readPort(leader);

    await shutdown(leader, 300);

    expect(isGroupAlive(leader)).toBe(false);
    expect(await canBind(port)).toBe(true);
  }, 15_000);
});
