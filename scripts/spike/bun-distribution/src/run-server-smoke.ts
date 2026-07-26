import { rmSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const dataDirectory = join(root, "artifacts", "server-smoke");
const port = "1371";
rmSync(dataDirectory, { force: true, recursive: true });

async function startServer(): Promise<ReturnType<typeof Bun.spawn>> {
  const child = Bun.spawn([process.execPath, join(import.meta.dir, "compiled-server.ts")], {
    cwd: root,
    env: { ...Bun.env, MIMIMILLI_DATA_DIR: dataDirectory, PORT: port },
    stderr: "inherit",
    stdout: "inherit",
  });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        return child;
      }
    } catch {
      await Bun.sleep(20);
    }
  }
  child.kill();
  throw new Error("compiled server did not become ready");
}

async function stopServer(process: ReturnType<typeof Bun.spawn>): Promise<void> {
  process.kill("SIGTERM");
  await process.exited;
}

const first = await startServer();
const write = await fetch(`http://127.0.0.1:${port}/values/restart`, {
  body: JSON.stringify({ value: "persisted" }),
  headers: { "content-type": "application/json" },
  method: "PUT",
});
if (!write.ok) {
  throw new Error(`write failed: ${write.status}`);
}
await stopServer(first);

const second = await startServer();
try {
  const read = await fetch(`http://127.0.0.1:${port}/values/restart`);
  const health = (await fetch(`http://127.0.0.1:${port}/health`).then((response) =>
    response.json(),
  )) as { launches: number };
  const value = (await read.json()) as { value?: string };
  if (!read.ok || value.value !== "persisted" || health.launches !== 2) {
    throw new Error(`restart read failed: ${JSON.stringify({ health, value })}`);
  }
  console.log("Hono + Bun.serve + bun:sqlite restart smoke: ok");
} finally {
  await stopServer(second);
}
