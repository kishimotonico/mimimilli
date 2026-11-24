import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { acquireSmokeLock } from "../smoke/smokeLock";

function freePort(): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolvePromise(port));
    });
  });
}

const releases: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(releases.splice(0).map((release) => release()));
});

async function acquire(
  port: number,
  extra: { log?: (m: string) => void; signal?: AbortSignal } = {},
) {
  const release = await acquireSmokeLock({
    port,
    pollIntervalMs: 10,
    log: () => {},
    ...extra,
  });
  releases.push(release);
  return release;
}

describe("acquireSmokeLock", () => {
  it("保持者がいる間は待ち、解放されたら取得する", async () => {
    const port = await freePort();
    const release = await acquire(port);
    const messages: string[] = [];
    let acquired = false;
    const second = acquire(port, { log: (m) => messages.push(m) }).then((r) => {
      acquired = true;
      return r;
    });
    await new Promise((r) => setTimeout(r, 100));
    expect(acquired).toBe(false);
    expect(messages).toHaveLength(1);
    await release();
    await second;
    expect(acquired).toBe(true);
  });

  it("所有者のプロセスが kill されると取得できる", async () => {
    const port = await freePort();
    const holder = spawn(process.execPath, [
      "-e",
      `require("node:net").createServer().listen(${port},"127.0.0.1",()=>console.log("held"));setInterval(()=>{},1000)`,
    ]);
    await new Promise<void>((resolvePromise) => {
      holder.stdout.once("data", () => resolvePromise());
    });
    const pending = acquire(port);
    holder.kill("SIGKILL");
    await expect(pending).resolves.toBeTypeOf("function");
  });

  it("待機中に signal が中断されると reject し、取得ループを続けない", async () => {
    const port = await freePort();
    await acquire(port);
    const abort = new AbortController();
    const waiting = acquire(port, { signal: abort.signal });
    setTimeout(() => abort.abort(), 50);
    await expect(waiting).rejects.toThrow();
  });

  it("使用中以外のエラーは待たずに投げる", async () => {
    await expect(
      acquireSmokeLock({ host: "192.0.2.1", port: await freePort(), log: () => {} }),
    ).rejects.toMatchObject({ code: "EADDRNOTAVAIL" });
  });
});
