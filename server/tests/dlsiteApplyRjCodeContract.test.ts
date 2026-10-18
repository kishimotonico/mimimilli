import assert from "node:assert/strict";
import { defineContract } from "./helpers/contractHarness.ts";

const contract = defineContract({ works: [{ key: "existing" }] });

function applyBody(rjCode: string, sourceRevision: string) {
  return {
    info: {
      rjCode,
      title: "x",
      circle: null,
      cvs: [],
      genreTags: [],
      ageRating: null,
      coverUrl: null,
      url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900002.html",
    },
    sourceRevision,
    applyTitle: false,
    applyTags: [],
    applyCover: false,
    applyUrl: true,
  };
}

contract("DLsite適用はinfo.rjCodeの形式が不正なら400で、メタを変更しない", async (harness) => {
  const id = harness.workId("existing");
  const before = await harness.adapter.getWorkEditSnapshot(id);
  for (const rjCode of ["", "abc", "RJ12345", "RJ123456789", "../RJ123456", "RJ123456\n.."]) {
    const res = await harness.send(
      "POST",
      `/api/dlsite/${id}/apply`,
      applyBody(rjCode, before!.sourceRevision),
    );
    assert.equal(res.status, 400, rjCode);
  }
  assert.deepEqual(await harness.adapter.getWorkEditSnapshot(id), before);

  const ok = await harness.send(
    "POST",
    `/api/dlsite/${id}/apply`,
    applyBody("rj900002", before!.sourceRevision),
  );
  assert.equal(ok.status, 200);
  assert.equal(ok.body.snapshot.dlsite.rjCode, "RJ900002");
});
