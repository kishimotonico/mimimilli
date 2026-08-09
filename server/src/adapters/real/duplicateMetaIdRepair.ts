import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { metaFileSchema } from "@mimimilli/shared";

export interface SeenMetaIds {
  work: Set<string>;
  playlist: Set<string>;
  track: Set<string>;
}

export interface DuplicateRepairResult {
  repaired: boolean;
  externallyModified: boolean;
}

type JsonObject = Record<string, unknown>;

function parseObject(content: string): JsonObject | null {
  try {
    const value: unknown = JSON.parse(content);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  } catch {
    return null;
  }
}

function playlistsOf(raw: JsonObject): JsonObject[] | null {
  if (!Array.isArray(raw.playlists)) return null;
  const playlists: JsonObject[] = [];
  for (const value of raw.playlists) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const playlist = value as JsonObject;
    if (!Array.isArray(playlist.tracks)) return null;
    if (
      playlist.tracks.some(
        (track) => typeof track !== "object" || track === null || Array.isArray(track),
      )
    ) {
      return null;
    }
    playlists.push(playlist);
  }
  return playlists;
}

function hasCompleteIds(raw: JsonObject, playlists: JsonObject[]): boolean {
  if (typeof raw.id !== "string") return false;
  if (raw.defaultPlaylistId !== null && typeof raw.defaultPlaylistId !== "string") return false;
  return playlists.every(
    (playlist) =>
      typeof playlist.id === "string" &&
      (playlist.tracks as JsonObject[]).every((track) => typeof track.id === "string"),
  );
}

function registerSeenIds(raw: JsonObject, playlists: JsonObject[], seenIds: SeenMetaIds): void {
  seenIds.work.add(raw.id as string);
  for (const playlist of playlists) {
    seenIds.playlist.add(playlist.id as string);
    for (const track of playlist.tracks as JsonObject[]) {
      seenIds.track.add(track.id as string);
    }
  }
}

function repairDuplicates(raw: JsonObject, playlists: JsonObject[], seenIds: SeenMetaIds): boolean {
  let changed = false;
  const defaultPlaylistId =
    typeof raw.defaultPlaylistId === "string" ? raw.defaultPlaylistId : null;

  if (seenIds.work.has(raw.id as string)) {
    const oldDefaultPlaylistId =
      typeof raw.defaultPlaylistId === "string" ? raw.defaultPlaylistId : null;
    raw.id = crypto.randomUUID();
    let newDefaultPlaylistId: string | null = null;
    for (const playlist of playlists) {
      const wasDefault = typeof playlist.id === "string" && playlist.id === oldDefaultPlaylistId;
      playlist.id = crypto.randomUUID();
      if (wasDefault) newDefaultPlaylistId = playlist.id as string;
      for (const track of playlist.tracks as JsonObject[]) {
        track.id = crypto.randomUUID();
      }
    }
    raw.defaultPlaylistId = oldDefaultPlaylistId === null ? null : newDefaultPlaylistId;
    changed = true;
  } else {
    for (const playlist of playlists) {
      const oldPlaylistId = typeof playlist.id === "string" ? playlist.id : null;
      if (typeof playlist.id !== "string" || seenIds.playlist.has(playlist.id)) {
        playlist.id = crypto.randomUUID();
        changed = true;
      }
      if (oldPlaylistId !== null && oldPlaylistId === defaultPlaylistId) {
        raw.defaultPlaylistId = playlist.id as string;
      }
      for (const track of playlist.tracks as JsonObject[]) {
        if (typeof track.id !== "string" || seenIds.track.has(track.id)) {
          track.id = crypto.randomUUID();
          changed = true;
        }
      }
    }
  }

  return changed;
}

export function repairDuplicateMetaIds(
  metaPath: string,
  originalContent: string,
  seenIds: SeenMetaIds,
  checkAbort: () => void = () => {},
): DuplicateRepairResult {
  checkAbort();
  const raw = parseObject(originalContent);
  if (!raw) return { repaired: false, externallyModified: false };
  const playlists = playlistsOf(raw);
  if (!playlists || !hasCompleteIds(raw, playlists)) {
    return { repaired: false, externallyModified: false };
  }

  const changed = repairDuplicates(raw, playlists, seenIds);
  if (!changed) {
    registerSeenIds(raw, playlists, seenIds);
    return { repaired: false, externallyModified: false };
  }

  const parsed = metaFileSchema.safeParse(raw);
  if (!parsed.success) {
    return { repaired: false, externallyModified: false };
  }

  checkAbort();
  const current = readFileSync(metaPath, "utf-8");
  if (current !== originalContent) {
    return { repaired: false, externallyModified: true };
  }

  const temporary = join(dirname(metaPath), `.${basename(metaPath)}.${crypto.randomUUID()}.tmp`);
  writeFileSync(temporary, `${JSON.stringify(raw, null, 2)}\n`, "utf-8");
  try {
    checkAbort();
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
  const hashImmediatelyBeforeRename = readFileSync(metaPath, "utf-8");
  if (hashImmediatelyBeforeRename !== originalContent) {
    rmSync(temporary, { force: true });
    return { repaired: false, externallyModified: true };
  }
  renameSync(temporary, metaPath);
  registerSeenIds(raw, playlists, seenIds);
  return { repaired: true, externallyModified: false };
}
