// TASK-92: トラックの解決済み durationSec（resolveTrackDurationSec）の契約検証。
// end-start / end有start無 / start有end無 / 両無 / 同一ファイル複数区間 / デフォルト外playlist /
// probe失敗 の組み合わせを実データでカバーする。
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
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

  const adapter = createRealAdapter({ database: { kind: "memory" } });
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
  // probe失敗（ファイル欠損）: 0埋めせず null
  assert.equal(probeFailed?.durationSec, null);

  // デフォルト外playlistも全playlistのprobe対象としてdurationSecが解決されている
  const extraPlaylist = work.playlists.find((p) => p.id === extraPlaylistId);
  assert.ok(extraPlaylist);
  assert.equal(extraPlaylist.tracks[0]?.durationSec, 5);

  // totalDurationSec（デフォルトplaylist集計）はprobe失敗分を0扱いで合算する
  // （集計値としての仕様。トラック単位のDTOはnullのまま、0埋めしない）
  assert.equal(work.totalDurationSec, 3 + 5 + 2 + 5 + 0);

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
