// APIへのリクエストの出所検証（Host・Origin・Sec-Fetch-Site・JSON本文のContent-Type）を fixture / real の両方で検証。
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ApiError, SmartFolder } from "@mimimilli/shared";
import { createApp } from "../src/app.ts";
import { defineContract, type ContractHarness } from "./helpers/contractHarness.ts";

const contract = defineContract({ works: [{ key: "a" }] }, { shared: true });

const JSON_TYPE = { "Content-Type": "application/json" };

async function folderNames(harness: ContractHarness): Promise<string[]> {
  const { body } = await harness.json<SmartFolder[]>("/api/smart-folders");
  return body.map((folder) => folder.name);
}

function createFolderRequest(name: string, headers: Record<string, string>) {
  return {
    method: "POST",
    headers: { ...JSON_TYPE, ...headers },
    body: JSON.stringify({ name, rules: [], sort: "added-desc" }),
  };
}

async function assertRejected(
  harness: ContractHarness,
  name: string,
  headers: Record<string, string>,
  url = "/api/smart-folders",
  status = 403,
  code = "forbidden",
): Promise<void> {
  const res = await harness.app.request(url, createFolderRequest(name, headers));
  assert.equal(res.status, status, name);
  assert.equal(((await res.json()) as ApiError).error.code, code, name);
  assert.ok(!(await folderNames(harness)).includes(name), `${name} が作成されている`);
}

async function assertAccepted(
  harness: ContractHarness,
  name: string,
  headers: Record<string, string>,
  url = "/api/smart-folders",
): Promise<void> {
  const res = await harness.app.request(url, createFolderRequest(name, headers));
  assert.equal(res.status, 201, name);
  assert.ok((await folderNames(harness)).includes(name), `${name} が作成されていない`);
}

contract("外部Hostは拒否し、状態を変えない", async (harness) => {
  for (const host of ["evil.example", "127.0.0.1.evil.example", "localhost.evil.example"]) {
    await assertRejected(harness, `host-${host}`, { Host: host });
    const get = await harness.app.request("/api/works", { headers: { Host: host } });
    assert.equal(get.status, 403, host);
  }
  await assertRejected(harness, "host-userinfo", { Host: "localhost@evil.example" });
  await assertRejected(harness, "host-backslash", { Host: "localhost\\.evil.example" });
});

contract("loopbackのHostは通す（ポート・大文字小文字を問わない）", async (harness) => {
  const hosts = [
    "task-506.mimi.localhost:1355",
    "mimi.localhost",
    "localhost",
    "LOCALHOST:3000",
    "127.0.0.1:3000",
    "[::1]:1355",
  ];
  for (const host of hosts) {
    await assertAccepted(harness, `host-ok-${host}`, { Host: host });
  }
});

contract("Hostヘッダーが無いときは要求URLのhostnameで判定する", async (harness) => {
  const rejected = await harness.app.request("http://evil.example/api/works");
  assert.equal(rejected.status, 403);
  await assertRejected(harness, "url-evil", {}, "http://evil.example/api/smart-folders");
  await assertAccepted(harness, "url-localhost", {}, "http://localhost/api/smart-folders");
});

contract("Hostヘッダーが外部なら要求URLがlocalhostでも拒否する", async (harness) => {
  await assertRejected(
    harness,
    "header-evil-url-local",
    { Host: "evil.example" },
    "http://localhost/api/smart-folders",
  );
});

contract("外部Origin・Origin: null・解析不能なOriginは拒否する", async (harness) => {
  for (const [label, origin] of [
    ["evil", "http://evil.example"],
    ["null", "null"],
    ["garbage", "not a url"],
    ["lookalike", "http://localhost.evil.example"],
  ] as const) {
    await assertRejected(harness, `origin-${label}`, { Origin: origin });
  }
});

contract(
  "Sec-Fetch-Site: cross-site は拒否し、same-origin・same-site・none は通す",
  async (harness) => {
    await assertRejected(harness, "fetch-cross", { "Sec-Fetch-Site": "cross-site" });
    await assertRejected(harness, "fetch-cross-local-origin", {
      Origin: "http://localhost:5173",
      "Sec-Fetch-Site": "cross-site",
    });
    for (const site of ["same-origin", "same-site", "none"]) {
      await assertAccepted(harness, `fetch-${site}`, { "Sec-Fetch-Site": site });
    }
  },
);

contract("OriginとSec-Fetch-Siteの判定はANDで、片方では救済しない", async (harness) => {
  await assertRejected(harness, "conflict", {
    Origin: "http://evil.example",
    "Sec-Fetch-Site": "same-origin",
  });
  await assertAccepted(harness, "loopback-same-origin", {
    Origin: "http://task-506.mimi.localhost:1355",
    "Sec-Fetch-Site": "same-origin",
  });
  await assertAccepted(harness, "loopback-same-site", {
    Origin: "http://127.0.0.1:5173",
    "Sec-Fetch-Site": "same-site",
  });
});

contract("OriginもSec-Fetch-Siteも無いリクエストは通す", async (harness) => {
  await assertAccepted(harness, "no-origin", {});
});

contract("本文なしの外部Origin POSTも拒否する", async (harness) => {
  const res = await harness.app.request("/api/works/some-id/last-played", {
    method: "POST",
    headers: { Origin: "http://evil.example" },
  });
  assert.equal(res.status, 403);
  const scan = await harness.app.request("/api/scan", {
    method: "POST",
    headers: { Origin: "http://evil.example", "Sec-Fetch-Site": "cross-site" },
  });
  assert.equal(scan.status, 403);
});

contract(
  "GETは外部Originでも出所検証の対象外で、OPTIONSにCORSヘッダーを付けない",
  async (harness) => {
    const get = await harness.app.request("/api/works", {
      headers: { Origin: "http://evil.example", "Sec-Fetch-Site": "cross-site" },
    });
    assert.equal(get.status, 200);
    for (const res of [
      get,
      await harness.app.request("/api/smart-folders", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:5173",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type",
        },
      }),
    ]) {
      const cors = [...res.headers.keys()].filter((key) => key.startsWith("access-control-"));
      assert.deepEqual(cors, []);
    }
  },
);

contract(
  "JSON本文のメディア型がapplication/jsonでなければ415で、状態を変えない",
  async (harness) => {
    const body = JSON.stringify({ name: "text-plain", rules: [], sort: "added-desc" });
    for (const headers of [
      { "Content-Type": "text/plain" },
      {},
      { "Content-Type": "application/jsonx" },
    ] as Array<Record<string, string>>) {
      const res = await harness.app.request("/api/smart-folders", {
        method: "POST",
        headers,
        body,
      });
      assert.equal(res.status, 415, JSON.stringify(headers));
      assert.equal(((await res.json()) as ApiError).error.code, "unsupported_media_type");
    }
    assert.ok(!(await folderNames(harness)).includes("text-plain"));
  },
);

contract("パラメータ付き・大文字小文字違いのapplication/jsonは通す", async (harness) => {
  for (const [index, type] of ["application/json; charset=utf-8", "Application/JSON"].entries()) {
    const res = await harness.app.request("/api/smart-folders", {
      method: "POST",
      headers: { "Content-Type": type },
      body: JSON.stringify({ name: `ct-${index}`, rules: [], sort: "added-desc" }),
    });
    assert.equal(res.status, 201, type);
  }
});

contract("本文なしの任意ボディrouteは通る", async (harness) => {
  const res = await harness.app.request("/api/scan", { method: "POST" });
  assert.equal(res.status, 202);
});

contract("静的配信にもHost検証が効く", async (harness) => {
  const dir = mkdtempSync(join(tmpdir(), "mimimilli-origin-"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><body>app</body>");
  const app = createApp(harness.adapter, { staticDir: dir });
  try {
    const evil = await app.request("/", { headers: { Host: "evil.example" } });
    assert.equal(evil.status, 403);
    const local = await app.request("/", { headers: { Host: "mimi.localhost:1355" } });
    assert.equal(local.status, 200);
  } finally {
    await app.shutdown();
  }
});
