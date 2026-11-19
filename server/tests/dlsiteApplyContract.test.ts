// 作品詳細のDLsite適用の契約。DLsite情報はキャッシュから読み、クライアントのinfoは受け付けない（ADR-0033）。
import assert from "node:assert/strict";
import { DEFAULT_DLSITE_REQUEST_CONFIG } from "../src/adapters/real/dlsiteConfig.ts";
import { FIXTURE_DLSITE_NO_COVER_RJ_CODE } from "../src/adapters/fixture/dlsiteMethods.ts";
import { defineContract, type ContractHarness } from "./helpers/contractHarness.ts";
import {
  coverUrlFromRequest,
  htmlResponse,
  jpegResponse,
  mockDlsiteTransport,
  sampleWorkHtml,
} from "./helpers/dlsiteTransport.ts";
import { SAMPLE_COVER_JPEG_BASE64 } from "./helpers/sampleLibrary.ts";

const SAMPLE_COVER = new Uint8Array(Buffer.from(SAMPLE_COVER_JPEG_BASE64, "base64"));
const OK_CODE = "RJ000001";
const NOT_CACHED_CODE = "RJ000555";

const contract = defineContract({
  works: [{ key: "existing", title: "既存タイトル", tags: ["cv/既存"] }],
  real: {
    dlsiteRequestConfig: {
      ...DEFAULT_DLSITE_REQUEST_CONFIG,
      requestIntervalMs: 0,
      retryCount: 0,
      maxBackoffMs: 0,
      timeoutMs: 1_000,
    },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: (code) =>
        code === FIXTURE_DLSITE_NO_COVER_RJ_CODE
          ? htmlResponse(sampleWorkHtml(code, { title: `タイトル${code}`, cover: false }))
          : htmlResponse(sampleWorkHtml(code, { title: `タイトル${code}` })),
      cover: (url) =>
        coverUrlFromRequest(url) ? jpegResponse(SAMPLE_COVER) : htmlResponse("", 404),
    }),
  },
});

const NOTHING = { title: false, cover: false, url: false, tags: [] as string[] };

interface Fetched {
  info: { title: string; url: string; circle: string | null; genreTags: string[] };
  infoRevision: number;
  cachedCover: { key: string; version: number } | null;
  sourceRevision: string;
}

async function setCode(h: ContractHarness, id: string, rjCode: string | null) {
  const snapshot = await h.adapter.getWorkEditSnapshot(id);
  const res = await h.send("PATCH", `/api/dlsite/${id}`, {
    sourceRevision: snapshot!.sourceRevision,
    rjCode,
  });
  return res;
}

async function fetchFor(h: ContractHarness, id: string, rjCode: string): Promise<Fetched> {
  assert.equal((await setCode(h, id, rjCode)).status, 200);
  const res = await h.send("POST", `/api/dlsite/${id}/fetch`);
  assert.equal(res.status, 200);
  return res.body as Fetched;
}

function apply(h: ContractHarness, id: string, body: unknown) {
  return h.send("POST", `/api/dlsite/${id}/apply`, body);
}

contract("取得の応答に版とカバーのキャッシュ有無が付く", async (h) => {
  const id = h.workId("existing");
  const fetched = await fetchFor(h, id, OK_CODE);
  assert.equal(typeof fetched.infoRevision, "number");
  assert.ok(fetched.cachedCover);
  const noCover = await fetchFor(h, id, FIXTURE_DLSITE_NO_COVER_RJ_CODE);
  assert.equal(noCover.cachedCover, null);
});

contract("適用は選んだ項目だけを、キャッシュのDLsite情報から反映する", async (h) => {
  const id = h.workId("existing");
  const fetched = await fetchFor(h, id, OK_CODE);
  const genre = `genre/${fetched.info.genreTags[0]}`;

  const res = await apply(h, id, {
    sourceRevision: fetched.sourceRevision,
    infoRevision: fetched.infoRevision,
    apply: { title: true, cover: true, url: true, tags: [genre] },
  });
  assert.equal(res.status, 200);
  const work = await h.adapter.getWork(id);
  assert.equal(work!.title, fetched.info.title);
  assert.deepEqual(work!.urls, [{ label: "DLsite", url: fetched.info.url }]);
  assert.deepEqual(work!.tags, ["cv/既存", genre]);
  assert.ok(work!.cover);
  assert.equal(work!.dlsite.status, "applied");
  assert.deepEqual(work!.dlsite.appliedTags, [genre]);
});

contract("何も選ばない適用は、作品を変えずに連携済みにする", async (h) => {
  const id = h.workId("existing");
  const fetched = await fetchFor(h, id, OK_CODE);
  const res = await apply(h, id, {
    sourceRevision: fetched.sourceRevision,
    infoRevision: fetched.infoRevision,
    apply: NOTHING,
  });
  assert.equal(res.status, 200);
  const work = await h.adapter.getWork(id);
  assert.equal(work!.title, "既存タイトル");
  assert.deepEqual(work!.tags, ["cv/既存"]);
  assert.equal(work!.dlsite.status, "applied");
});

contract("bodyにinfoを混ぜても、反映されるのはキャッシュの内容", async (h) => {
  const id = h.workId("existing");
  const fetched = await fetchFor(h, id, OK_CODE);
  const res = await apply(h, id, {
    sourceRevision: fetched.sourceRevision,
    infoRevision: fetched.infoRevision,
    apply: { ...NOTHING, title: true, url: true },
    info: {
      rjCode: OK_CODE,
      title: "偽のタイトル",
      circle: null,
      cvs: [],
      genreTags: [],
      ageRating: null,
      coverUrl: null,
      url: "https://www.dlsite.com/fake",
    },
  });
  assert.equal(res.status, 200);
  const work = await h.adapter.getWork(id);
  assert.equal(work!.title, fetched.info.title);
  assert.deepEqual(work!.urls, [{ label: "DLsite", url: fetched.info.url }]);
});

contract("DLsiteのタグでない値をtagsに混ぜても無視する", async (h) => {
  const id = h.workId("existing");
  const fetched = await fetchFor(h, id, OK_CODE);
  const res = await apply(h, id, {
    sourceRevision: fetched.sourceRevision,
    infoRevision: fetched.infoRevision,
    apply: { ...NOTHING, tags: ["任意のタグ"] },
  });
  assert.equal(res.status, 200);
  assert.deepEqual((await h.adapter.getWork(id))!.tags, ["cv/既存"]);
});

contract("sourceRevisionが違う適用は409 source_changedで、メタを変えない", async (h) => {
  const id = h.workId("existing");
  const fetched = await fetchFor(h, id, OK_CODE);
  const before = await h.adapter.getWorkEditSnapshot(id);
  const res = await apply(h, id, {
    sourceRevision: "stale",
    infoRevision: fetched.infoRevision,
    apply: { ...NOTHING, title: true },
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, "source_changed");
  assert.deepEqual(await h.adapter.getWorkEditSnapshot(id), before);
});

contract("infoRevisionが違う適用は409 dlsite_refetch_requiredで、メタを変えない", async (h) => {
  const id = h.workId("existing");
  const fetched = await fetchFor(h, id, OK_CODE);
  const before = await h.adapter.getWorkEditSnapshot(id);
  const res = await apply(h, id, {
    sourceRevision: fetched.sourceRevision,
    infoRevision: fetched.infoRevision + 1,
    apply: { ...NOTHING, title: true },
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, "dlsite_refetch_required");
  assert.deepEqual(await h.adapter.getWorkEditSnapshot(id), before);
});

contract("取得していないコードの適用は409 dlsite_refetch_required", async (h) => {
  const id = h.workId("existing");
  assert.equal((await setCode(h, id, NOT_CACHED_CODE)).status, 200);
  const snapshot = await h.adapter.getWorkEditSnapshot(id);
  const res = await apply(h, id, {
    sourceRevision: snapshot!.sourceRevision,
    infoRevision: 1,
    apply: { ...NOTHING, title: true },
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, "dlsite_refetch_required");
});

contract("カバーがキャッシュに無いときは、カバーだけ反映せず適用が成功する", async (h) => {
  const id = h.workId("existing");
  const fetched = await fetchFor(h, id, FIXTURE_DLSITE_NO_COVER_RJ_CODE);
  const res = await apply(h, id, {
    sourceRevision: fetched.sourceRevision,
    infoRevision: fetched.infoRevision,
    apply: { title: true, cover: true, url: true, tags: [] },
  });
  assert.equal(res.status, 200);
  const work = await h.adapter.getWork(id);
  assert.equal(work!.title, fetched.info.title);
  assert.equal(work!.cover, null);
  assert.equal(work!.dlsite.status, "applied");
});

contract("info・applyTitleを含むbodyは400", async (h) => {
  const id = h.workId("existing");
  const fetched = await fetchFor(h, id, OK_CODE);
  const res = await apply(h, id, {
    sourceRevision: fetched.sourceRevision,
    applyTitle: true,
    applyTags: [],
    applyCover: false,
    applyUrl: true,
    info: fetched.info,
  });
  assert.equal(res.status, 400);
});

contract("RJコードは空文字（コードなしの明示）で保存でき、nullは受け付けない", async (h) => {
  const id = h.workId("existing");
  assert.equal((await setCode(h, id, OK_CODE)).status, 200);
  assert.equal((await setCode(h, id, null)).status, 400);
  const cleared = await setCode(h, id, "");
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.snapshot.dlsite.rjCode, "");
});
