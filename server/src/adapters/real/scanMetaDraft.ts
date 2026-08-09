import type { MetaFile, NormalizedTag, Track, UrlEntry } from "@mimimilli/shared";
import { emptyDlsiteState } from "@mimimilli/shared";
import { buildDefaultTracks, findCoverImage } from "./scanAudio.ts";

export function createDraftMetaFile(
  workDir: string,
  fields: {
    id: string;
    title: string;
    urls?: UrlEntry[];
    tags?: NormalizedTag[];
    coverImage?: string | null;
    dlsite?: MetaFile["dlsite"];
    tracks?: Track[];
  },
): MetaFile {
  const tracks = fields.tracks ?? buildDefaultTracks(workDir);
  const playlistId = tracks.length > 0 ? crypto.randomUUID() : null;
  return {
    id: fields.id,
    title: fields.title,
    urls: fields.urls ?? [],
    tags: fields.tags ?? [],
    coverImage: fields.coverImage !== undefined ? fields.coverImage : findCoverImage(workDir),
    playlists: playlistId ? [{ id: playlistId, name: "default", tracks }] : [],
    defaultPlaylistId: playlistId,
    createdAt: new Date().toISOString(),
    dlsite: fields.dlsite ?? emptyDlsiteState(),
  };
}
