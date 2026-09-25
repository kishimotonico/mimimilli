// 作品の配置形式。正本は metaPath のファイル名（ADR-0032）。
import {
  META_FILE_NAME,
  isAudioFileName,
  isSidecarMetaFileName,
  sidecarMetaFileName,
  type MetaFile,
} from "./meta.ts";
import { selectDefaultPlaylist } from "./work.ts";

export type WorkPlacement =
  | { kind: "folder"; metaPath: string; mediaRoot: string }
  | { kind: "audio-file"; metaPath: string; mediaRoot: string };

export type WorkPlacementResolution =
  | { ok: true; placement: WorkPlacement; physicalPath: string }
  | { ok: false; placement: WorkPlacement; physicalPath: string; message: string };

export const WORK_PLACEMENT_MISMATCH_PREFIX = "配置形式が不整合です: ";

function lastSeparatorIndex(path: string): number {
  return Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
}

function hasSeparator(name: string): boolean {
  return name.includes("/") || name.includes("\\");
}

function metaFileNameOf(metaPath: string): string {
  return metaPath.slice(lastSeparatorIndex(metaPath) + 1);
}

/** 保存済みの metaPath から配置を得る。メタの中身は見ない */
export function workPlacementOf(metaPath: string): WorkPlacement {
  const cut = lastSeparatorIndex(metaPath);
  const name = metaPath.slice(cut + 1);
  const mediaRoot = cut === 0 ? metaPath.slice(0, 1) : metaPath.slice(0, Math.max(cut, 0));
  if (name === META_FILE_NAME) return { kind: "folder", metaPath, mediaRoot };
  if (isSidecarMetaFileName(name)) return { kind: "audio-file", metaPath, mediaRoot };
  throw new Error(`メタファイル名ではありません: ${metaPath}`);
}

/** 配置からの相対パスを、metaPath と同じ区切りで絶対パスにする */
function joinMediaRoot(placement: WorkPlacement, file: string): string {
  const { metaPath } = placement;
  return `${metaPath.slice(0, lastSeparatorIndex(metaPath) + 1)}${file}`;
}

export function workPlacementNotAFileMessage(placement: WorkPlacement, audioFile: string): string {
  return `${WORK_PLACEMENT_MISMATCH_PREFIX}${metaFileNameOf(placement.metaPath)} が指す ${audioFile} はファイルとして存在しません`;
}

/** メタの中身と配置の対応を検査して physicalPath を決める。ファイルシステムは見ない */
export function resolveWorkPlacement(
  metaPath: string,
  meta: Pick<MetaFile, "playlists" | "defaultPlaylistId">,
): WorkPlacementResolution {
  const placement = workPlacementOf(metaPath);
  if (placement.kind === "folder") {
    return { ok: true, placement, physicalPath: placement.mediaRoot };
  }
  const metaName = metaFileNameOf(metaPath);
  const mismatch = (detail: string): WorkPlacementResolution => ({
    ok: false,
    placement,
    physicalPath: metaPath,
    message: `${WORK_PLACEMENT_MISMATCH_PREFIX}${metaName} ${detail}`,
  });

  const tracks = selectDefaultPlaylist(meta.playlists, meta.defaultPlaylistId)?.tracks ?? [];
  if (tracks.length !== 1) {
    return mismatch(
      `の既定プレイリストにはトラックが1つだけ必要です（${tracks.length}件あります）`,
    );
  }
  const audioFile = tracks[0]!.file;
  if (
    hasSeparator(audioFile) ||
    !isAudioFileName(audioFile) ||
    sidecarMetaFileName(audioFile) !== metaName
  ) {
    return mismatch(
      `のトラックが参照する ${audioFile} は、このメタファイルに対応する音声ファイルではありません`,
    );
  }
  for (const playlist of meta.playlists) {
    const other = playlist.tracks.find((track) => track.file !== audioFile);
    if (other) {
      return mismatch(
        `のプレイリスト「${playlist.name}」が ${audioFile} 以外のファイル（${other.file}）を参照しています`,
      );
    }
  }
  return { ok: true, placement, physicalPath: joinMediaRoot(placement, audioFile) };
}
