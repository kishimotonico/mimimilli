import type { Track } from "@mimimilli/shared";
import type { FsEntry } from "./types";
import { classifyFile, sortEntries } from "./types";

/** 同一フォルダー内の音声ファイルを表示順でキュー化する */
export function buildFolderAudioQueue(
  folderEntries: FsEntry[],
  startEntry: FsEntry,
): { tracks: Track[]; trackIndex: number } {
  const audioFiles = sortEntries(folderEntries).filter((e) => classifyFile(e) === "audio");
  const trackIndex = audioFiles.findIndex((e) => e.path === startEntry.path);
  if (trackIndex < 0) return { tracks: [], trackIndex: 0 };
  const tracks = audioFiles.map((e) => ({
    id: e.path,
    title: e.name,
    file: e.path,
  }));
  return { tracks, trackIndex };
}
