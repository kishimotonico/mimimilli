import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { workspacePath, type ScanCandidateBody } from "@mimimilli/shared";
import type { ScanJobManager } from "../src/scanJobManager.ts";
import { scanRoute } from "../src/routes/scan.ts";

const candidate: ScanCandidateBody = {
  path: workspacePath("作品"),
  inferredTitle: "作品",
  audioFileCount: 1,
  audioBreakdown: [{ extension: "mp3", count: 1 }],
  rjCode: "RJ000001",
  rjCodeEdited: false,
  dlsite: { state: "none" },
  missingWorks: [],
};

/** 候補の集約の途中（キャッシュを読む位置）で、取得ジョブが1つ終端に進む */
function appWithAdvancingRevision() {
  let revision = 100;
  const jobs = {
    session: {
      listCandidates: async () => {
        revision += 1;
        return { scanCompleted: true, candidates: [candidate] };
      },
      setRjCode: async () => {
        revision += 1;
        return candidate;
      },
    },
  } as unknown as ScanJobManager;
  const app = new Hono();
  app.route("/", scanRoute(jobs, { revision: () => revision }));
  return { app, terminalRevisionDuringAggregation: () => revision };
}

test("候補一覧のdlsiteRevisionは、集約を始める前に読んだ値で、集約中に終わった取得より小さい", async () => {
  const { app, terminalRevisionDuringAggregation } = appWithAdvancingRevision();
  const response = await app.request("/scan/candidates");
  const body = (await response.json()) as { candidates: Array<{ dlsiteRevision: number }> };
  assert.equal(body.candidates[0]!.dlsiteRevision, 100);
  assert.ok(body.candidates[0]!.dlsiteRevision < terminalRevisionDuringAggregation());
});

test("RJコードを直した応答のdlsiteRevisionも、集約を始める前に読んだ値", async () => {
  const { app, terminalRevisionDuringAggregation } = appWithAdvancingRevision();
  const response = await app.request("/scan/candidates/rj-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "作品", rjCode: "RJ000001" }),
  });
  const body = (await response.json()) as { candidate: { dlsiteRevision: number } };
  assert.equal(body.candidate.dlsiteRevision, 100);
  assert.ok(body.candidate.dlsiteRevision < terminalRevisionDuringAggregation());
});
