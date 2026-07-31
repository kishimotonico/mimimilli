// TASK-92: トラックの解決済み durationSec（resolveTrackDurationSec）の契約検証。
// end-start / end有start無 / start有end無 / 両無 / 同一ファイル複数区間 / デフォルト外playlist /
// probe失敗 の組み合わせを実データでカバーする。
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { WorksQuery } from "@mimimilli/shared";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

test("durationSec: end-start / end有start無 / start有end無 / 両無 / 同一ファイル複数区間 / デフォルト外playlist / probe失敗", async (t) => {
  const directory = makeTestDirectory("track-duration-combo");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workDir = join(root, "RJ900010_区間テスト");
  mkdirSync(workDir, { recursive: true });

  // shared.wav は10秒の実ファイル（同一ファイル複数区間・end有start無・start有end無で共有）
  writeWav(join(workDir, "shared.wav"), 10);
  // whole.wav は5秒の実ファイル（両無=ファイル全体で使用）
  writeWav(join(workDir, "whole.wav"), 5);
  // missing.wav は実体を書かず、probe失敗（ファイル欠損）を模す

  const id = crypto.randomUUID();
  const defaultPlaylistId = crypto.randomUUID();
  const extraPlaylistId = crypto.randomUUID();
  writeFileSync(
    join(workDir, ".meta.json"),
    JSON.stringify(
      {
        id,
        title: "区間テスト",
        tags: [],
        defaultPlaylistId,
        playlists: [
          {
            id: defaultPlaylistId,
            name: "default",
            tracks: [
              { id: crypto.randomUUID(), title: "end有start無", file: "shared.wav", end: 3 },
              {
                id: crypto.randomUUID(),
                title: "end-start(後続区間)",
                file: "shared.wav",
                start: 3,
                end: 8,
              },
              { id: crypto.randomUUID(), title: "start有end無", file: "shared.wav", start: 8 },
              { id: crypto.randomUUID(), title: "両無", file: "whole.wav" },
              { id: crypto.randomUUID(), title: "probe失敗", file: "missing.wav" },
            ],
          },
          {
            id: extraPlaylistId,
            name: "デフォルト外",
            tracks: [
              {
                id: crypto.randomUUID(),
                title: "デフォルト外playlistのトラック",
                file: "whole.wav",
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
  );

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: root });
  await adapter.scan();

  const work = await adapter.getWork(id);
  assert.ok(work);

  const defaultPlaylist = work.playlists.find((p) => p.id === defaultPlaylistId);
  assert.ok(defaultPlaylist);
  const [endOnly, endStart, startOnly, wholeFile, probeFailed] = defaultPlaylist.tracks;

  // end有 start無: end(3) - start(0)
  assert.equal(endOnly?.durationSec, 3);
  // end-start（同一ファイルの後続区間）: end(8) - start(3)
  assert.equal(endStart?.durationSec, 5);
  // start有 end無: ファイル全体長(10) - start(8)
  assert.equal(startOnly?.durationSec, 2);
  // 両無: ファイル全体長そのもの
  assert.equal(wholeFile?.durationSec, 5);
  // probe失敗（ファイル欠損）: 0埋めせず null、durationKind は missing
  assert.equal(probeFailed?.durationSec, null);
  assert.equal(probeFailed?.durationKind, "missing");

  // デフォルト外playlistも全playlistのprobe対象としてdurationSecが解決されている
  const extraPlaylist = work.playlists.find((p) => p.id === extraPlaylistId);
  assert.ok(extraPlaylist);
  assert.equal(extraPlaylist.tracks[0]?.durationSec, 5);

  // totalDurationSec（デフォルトplaylist集計）は未解決トラックを1件でも含む場合はnull
  // （部分和を完全な総時間として保存しない）
  assert.equal(work.totalDurationSec, null);

  // resume検証: durationSec既知のトラックは区間外offsetを拒否する
  assert.equal(
    await adapter.saveResume(id, {
      playlistId: defaultPlaylist.id,
      trackId: startOnly!.id,
      offsetSec: 1,
    }),
    true,
  );
  await assert.rejects(() =>
    adapter.saveResume(id, {
      playlistId: defaultPlaylist.id,
      trackId: startOnly!.id,
      offsetSec: 3,
    }),
  );

  // resume検証: durationSecが未知（probe失敗）のトラックは上限不明として検証をスキップする
  assert.equal(
    await adapter.saveResume(id, {
      playlistId: defaultPlaylist.id,
      trackId: probeFailed!.id,
      offsetSec: 9999,
    }),
    true,
  );
});

test("startがファイル全体長以上のトラックは作品をerror状態にし、durationSecは0でなくnullになる", async (t) => {
  const directory = makeTestDirectory("track-duration-invalid-start");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workDir = join(root, "RJ900011_不正start");
  mkdirSync(workDir, { recursive: true });

  // 実ファイルは5秒。start=5（ちょうど全体長）と start=9（超過）はいずれも区間長が0以下になる。
  writeWav(join(workDir, "short.wav"), 5);

  const id = crypto.randomUUID();
  const defaultPlaylistId = crypto.randomUUID();
  writeFileSync(
    join(workDir, ".meta.json"),
    JSON.stringify(
      {
        id,
        title: "不正start",
        tags: [],
        defaultPlaylistId,
        playlists: [
          {
            id: defaultPlaylistId,
            name: "default",
            tracks: [
              { id: crypto.randomUUID(), title: "start=全体長", file: "short.wav", start: 5 },
              { id: crypto.randomUUID(), title: "start超過", file: "short.wav", start: 9 },
            ],
          },
        ],
      },
      null,
      2,
    ),
  );

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: root });
  await adapter.scan();

  const work = await adapter.getWork(id);
  assert.ok(work);

  // データ不正はDTOへ0/負値を流さず、作品のerrorとして可視化する。
  assert.equal(work.status, "error");
  assert.match(work.errorMessage ?? "", /開始位置がファイル長を超えています/);

  const tracks = work.playlists.find((p) => p.id === defaultPlaylistId)?.tracks;
  assert.equal(tracks?.[0]?.durationSec, null);
  assert.equal(tracks?.[0]?.durationKind, "invalid-start");
  assert.equal(tracks?.[1]?.durationSec, null);
  assert.equal(tracks?.[1]?.durationKind, "invalid-start");

  // 未解決トラックを含むため合計も未知。
  assert.equal(work.totalDurationSec, null);
});

test("end指定トラックでもstartがファイル全体長を超えていれば作品をerror状態にする", async (t) => {
  const directory = makeTestDirectory("track-duration-invalid-start-with-end");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workDir = join(root, "RJ900012_end指定不正start");
  mkdirSync(workDir, { recursive: true });

  // 実ファイルは5秒。start:9, end:10 は end-start自体は正の値(1)になるため、
  // end有無で判定を分岐していると素通りしてしまう不正区間。
  writeWav(join(workDir, "short.wav"), 5);

  const id = crypto.randomUUID();
  const defaultPlaylistId = crypto.randomUUID();
  writeFileSync(
    join(workDir, ".meta.json"),
    JSON.stringify(
      {
        id,
        title: "end指定不正start",
        tags: [],
        defaultPlaylistId,
        playlists: [
          {
            id: defaultPlaylistId,
            name: "default",
            tracks: [
              {
                id: crypto.randomUUID(),
                title: "start超過(end指定あり)",
                file: "short.wav",
                start: 9,
                end: 10,
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
  );

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: root });
  await adapter.scan();

  const work = await adapter.getWork(id);
  assert.ok(work);

  // end指定済みはend-startが自明値のため、可視化は作品のerror化（status/errorMessage）で行う。
  // 以前はend===undefinedの分岐内でしかstart超過を判定していなかったため、この区間は
  // probeされずstatus "ok"のまま見過ごされていた。
  assert.equal(work.status, "error");
  assert.match(work.errorMessage ?? "", /開始位置がファイル長を超えています/);
  const track = work.playlists.find((p) => p.id === defaultPlaylistId)?.tracks[0];
  assert.equal(track?.durationSec, null);
  assert.equal(track?.durationKind, "invalid-start");
});

test("endがファイル実測長をわずかに超えるだけの正常データはerrorにしない", async (t) => {
  const directory = makeTestDirectory("track-duration-end-slightly-over");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workDir = join(root, "RJ900014_end微小超過");
  mkdirSync(workDir, { recursive: true });

  // 実ファイルは5秒。コンテナのメタデータとデコード実測値には数十msのズレが出うるため、
  // end(5.04)が実測長(5)をわずかに超えるのは正常データ。startのファイル長超過とは区別する。
  writeWav(join(workDir, "whole.wav"), 5);

  const id = crypto.randomUUID();
  const defaultPlaylistId = crypto.randomUUID();
  writeFileSync(
    join(workDir, ".meta.json"),
    JSON.stringify(
      {
        id,
        title: "end微小超過",
        tags: [],
        defaultPlaylistId,
        playlists: [
          {
            id: defaultPlaylistId,
            name: "default",
            tracks: [
              { id: crypto.randomUUID(), title: "end微小超過", file: "whole.wav", end: 5.04 },
            ],
          },
        ],
      },
      null,
      2,
    ),
  );

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: root });
  await adapter.scan();

  const work = await adapter.getWork(id);
  assert.ok(work);

  assert.equal(work.status, "ok");
  assert.equal(work.errorMessage, null);

  const track = work.playlists.find((p) => p.id === defaultPlaylistId)?.tracks[0];
  assert.equal(track?.durationSec, 5.04);
});

test("rescan無しのファイル差し替え後、getWorkのtotalDurationSecはトラック合計と一致し保存列にも同期する", async (t) => {
  const directory = makeTestDirectory("track-duration-total-sync");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workDir = join(root, "RJ900013_総時間同期");
  mkdirSync(workDir, { recursive: true });

  // end未指定（ファイル全体を使う）トラック1本。ファイル全体長がそのままtotalDurationSecになる。
  writeWav(join(workDir, "whole.wav"), 5);

  const id = crypto.randomUUID();
  const defaultPlaylistId = crypto.randomUUID();
  const trackId = crypto.randomUUID();
  writeFileSync(
    join(workDir, ".meta.json"),
    JSON.stringify(
      {
        id,
        title: "総時間同期",
        tags: [],
        defaultPlaylistId,
        playlists: [
          {
            id: defaultPlaylistId,
            name: "default",
            tracks: [{ id: trackId, title: "whole", file: "whole.wav" }],
          },
        ],
      },
      null,
      2,
    ),
  );

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: root });
  await adapter.scan();

  const beforeWork = await adapter.getWork(id);
  assert.ok(beforeWork);
  assert.equal(beforeWork.totalDurationSec, 5);

  const baseQuery: WorksQuery = { q: "", tags: [], tagOp: "AND", sort: "added-desc" };
  const beforePage = await adapter.queryWorks(baseQuery);
  assert.equal(beforePage.items.find((item) => item.id === id)?.totalDurationSec, 5);

  // rescanせずにファイルを差し替える（8秒に変わる＝サイズもmtimeも変わる）。
  writeWav(join(workDir, "whole.wav"), 8);

  const afterWork = await adapter.getWork(id);
  assert.ok(afterWork);
  const track = afterWork.playlists.find((p) => p.id === defaultPlaylistId)?.tracks[0];
  // トラックのdurationSecはstat照合による再probeでライブに8秒へ更新される。
  assert.equal(track?.durationSec, 8);
  // totalDurationSecはスキャン時点の保存値(5)ではなく、トラック合計(8)と一致する。
  assert.equal(afterWork.totalDurationSec, 8);

  // 一覧のソート・フィルタが読む保存列(works.total_duration_sec)も、getWorkの読み取り時に同期される。
  const afterPage = await adapter.queryWorks(baseQuery);
  assert.equal(afterPage.items.find((item) => item.id === id)?.totalDurationSec, 8);
});
