import { describe, expect, it } from "vitest";
import type { FsEntry } from "@mimimilli/shared";
import { buildFolderAudioQueue } from "../../src/features/files/model/filePlayback";

function entry(name: string, overrides: Partial<FsEntry> = {}): FsEntry {
  return {
    name,
    path: `/root/${name}`,
    isDir: false,
    size: 1000,
    fileType: name.split(".").pop() ?? "",
    childCount: 0,
    workId: null,
    workRelPath: null,
    ...overrides,
  };
}

describe("buildFolderAudioQueue", () => {
  const folder = [
    entry("02_b.wav"),
    entry("folder", { isDir: true, fileType: "dir", path: "/root/folder" }),
    entry("01_a.mp3"),
    entry("cover.jpg", { fileType: "jpg" }),
    entry("03_c.flac"),
  ];

  it("表示順（ディレクトリ除外・名前昇順）で音声のみキュー化する", () => {
    const { tracks } = buildFolderAudioQueue(folder, entry("02_b.wav"));
    expect(tracks.map((t) => t.title)).toEqual(["01_a.mp3", "02_b.wav", "03_c.flac"]);
  });

  it("開始エントリのインデックスを返す", () => {
    const start = entry("03_c.flac");
    const { trackIndex } = buildFolderAudioQueue(folder, start);
    expect(trackIndex).toBe(2);
  });

  it("音声以外を指定した場合は空キュー", () => {
    const { tracks, trackIndex } = buildFolderAudioQueue(
      folder,
      entry("cover.jpg", { fileType: "jpg" }),
    );
    expect(tracks).toEqual([]);
    expect(trackIndex).toBe(0);
  });

  it("サブフォルダ内のファイルは含めない（呼び出し側が同一階層のみ渡す前提）", () => {
    const shallow = [entry("a.mp3"), entry("b.mp3")];
    const { tracks } = buildFolderAudioQueue(shallow, entry("b.mp3"));
    expect(tracks).toHaveLength(2);
  });
});
