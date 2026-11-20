import assert from "node:assert/strict";
import { test } from "node:test";
import type { DataAdapter } from "../src/adapter/index.ts";
import { createClassificationMethods } from "../src/adapters/fixture/classification.ts";
import { createCoverMediaMethods } from "../src/adapters/fixture/coverMedia.ts";
import { createDlsiteMethods } from "../src/adapters/fixture/dlsiteMethods.ts";
import { createFsMethods } from "../src/adapters/fixture/fsMethods.ts";
import { createWorkMethods } from "../src/adapters/fixture/works.ts";
import { createSettingsScanMethods } from "../src/adapters/fixture/settingsScan.ts";
import { createInitialState } from "../src/adapters/fixture/state.ts";
import { createApp } from "./helpers/testApp.ts";
import { createTestRealAdapter } from "./helpers/realAdapter.ts";

function fixtureWithoutRoot(): DataAdapter {
  const state = createInitialState({ scenario: "new-work" });
  state.rootFolder = null;
  return {
    ...createSettingsScanMethods(state),
    ...createWorkMethods(state),
    ...createClassificationMethods(state),
    ...createFsMethods(state),
    ...createCoverMediaMethods(state),
    ...createDlsiteMethods(state),
    resetFixtureState: () => {},
  };
}

const builders = {
  fixture: fixtureWithoutRoot,
  real: () => createTestRealAdapter({ database: { kind: "memory" } }),
};

for (const [kind, build] of Object.entries(builders)) {
  test(`ルート未設定の候補一覧は空を返す (${kind})`, async () => {
    const app = createApp(build());
    try {
      const res = await app.request("/api/scan/candidates");
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { scanCompleted: false, candidates: [] });
    } finally {
      await app.shutdown();
    }
  });
}
