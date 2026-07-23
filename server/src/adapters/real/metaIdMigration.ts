import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, relative } from "node:path";
import { metaFileSchema } from "@mimimilli/shared";

interface IdAssignment {
  workId: string;
  playlistIds: string[];
  trackIds: string[][];
  defaultPlaylistId: string | null;
}

interface MigrationOperation extends IdAssignment {
  relativePath: string;
  originalHash: string;
  migratedHash: string;
  originalAssignment: IdAssignment | null;
  completed: boolean;
}

/** hasCompleteUniqueIds が一度確認した内容の軽量な再現用シグネチャ（TASK-86）。
 *  size/mtimeMsが前回確認時から変わっていなければ、メタ本文を読まずにこのIDで
 *  重複判定へ参加させる。 */
interface VerifiedIdSignature {
  size: number;
  mtimeMs: number;
  workId: string;
  playlistIds: string[];
  trackIds: string[];
}

interface MigrationManifest {
  version: 1;
  libraryRoot: string;
  libraryCompleted: boolean;
  operations: MigrationOperation[];
  /** パス（platform依存の pathKey）ごとの VerifiedIdSignature。旧manifestには存在しない。 */
  verifiedIdSignatures?: Record<string, VerifiedIdSignature>;
}

export interface MetaIdMigrationOptions {
  root: string;
  metaPaths: string[];
  dataRoot: string;
  /** manifest永続化後の停止を再現するテスト専用フック。 */
  maxWrites?: number;
  /** Windowsのケース非区別パスキーを他OS上で検証するテスト専用指定。 */
  platform?: NodeJS.Platform;
  /** 一時ファイル作成後、rename直前の再検証前に割り込むテスト専用フック。 */
  beforeFinalHashCheck?: (metaPath: string) => void;
  /** メタ本文のSHA-256計算回数を観測するテスト専用フック。 */
  onMetaHash?: () => void;
  /** hasCompleteUniqueIdsがsize/mtimeMsキャッシュを外して本文を読み直した回数を観測するテスト専用フック（TASK-86）。 */
  onIdSignatureMiss?: () => void;
  /** WorkerのSharedArrayBufferを含む、同期処理中のキャンセル確認。throwして中断する。 */
  throwIfCancelled?: () => void;
}

export interface MetaIdMigrationResult {
  migrated: number;
  alreadyMigrated: number;
  externallyModified: string[];
}

type JsonObject = Record<string, unknown>;

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function portableRelative(root: string, path: string): string {
  return relative(root, path).replaceAll("\\", "/").normalize("NFC");
}

function pathKey(relativePath: string, platform: NodeJS.Platform): string {
  return platform === "win32" ? relativePath.toLocaleLowerCase("en-US") : relativePath;
}

function stableCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeJsonAtomic(path: string, value: unknown, checkpoint: () => void = () => {}): void {
  checkpoint();
  mkdirSync(dirname(path), { recursive: true });
  checkpoint();
  const temporary = join(dirname(path), `.${basename(path)}.${crypto.randomUUID()}.tmp`);
  writeFileSync(temporary, serialize(value), "utf-8");
  try {
    checkpoint();
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
  renameSync(temporary, path);
  checkpoint();
}

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
  if (raw.playlists === undefined) raw.playlists = [];
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

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function idsMatchAssignment(
  raw: JsonObject,
  playlists: JsonObject[],
  assignment: IdAssignment,
): boolean {
  if (
    raw.id !== assignment.workId ||
    raw.defaultPlaylistId !== assignment.defaultPlaylistId ||
    playlists.length !== assignment.playlistIds.length
  ) {
    return false;
  }
  return playlists.every((playlist, playlistIndex) => {
    const expectedTrackIds = assignment.trackIds[playlistIndex];
    const tracks = playlist.tracks as JsonObject[];
    return (
      playlist.id === assignment.playlistIds[playlistIndex] &&
      expectedTrackIds !== undefined &&
      tracks.length === expectedTrackIds.length &&
      tracks.every((track, trackIndex) => track.id === expectedTrackIds[trackIndex])
    );
  });
}

function completeAssignmentOf(raw: JsonObject, playlists: JsonObject[]): IdAssignment | null {
  if (typeof raw.id !== "string") return null;
  if (raw.defaultPlaylistId !== null && typeof raw.defaultPlaylistId !== "string") return null;
  if (
    playlists.some(
      (playlist) =>
        typeof playlist.id !== "string" ||
        (playlist.tracks as JsonObject[]).some((track) => typeof track.id !== "string"),
    )
  ) {
    return null;
  }
  return assignmentOf(raw, playlists);
}

interface HasCompleteUniqueIdsResult {
  ok: boolean;
  /** verifiedIdSignatures が更新され、manifest永続化が必要かどうか。 */
  signaturesChanged: boolean;
}

function statSizeAndMtime(path: string): { size: number; mtimeMs: number } | null {
  try {
    const stat = statSync(path);
    return { size: stat.size, mtimeMs: stat.mtimeMs };
  } catch {
    return null;
  }
}

/**
 * 完了済みライブラリの高速経路。IDの存在と重複だけを確認する。
 *
 * size/mtimeMs が前回のフルチェック時から変わっていないメタは、本文の
 * readFileSync+JSON.parse を省略し、manifest に記録済みの workId/playlistIds/trackIds を
 * そのまま重複判定に使う（TASK-86）。内容が変わっていない以上、IDも変わりようがない
 * ため検知漏れにはならない。size/mtimeMsどちらかでも変化したパスは、これまで通り
 * 本文を読んで完全に再検証する。
 */
function hasCompleteUniqueIds(
  paths: string[],
  root: string,
  platform: NodeJS.Platform,
  operationsByPath: Map<string, MigrationOperation[]>,
  manifest: MigrationManifest,
  checkpoint: () => void = () => {},
  onIdSignatureMiss: () => void = () => {},
): HasCompleteUniqueIdsResult {
  const previousSignatures = manifest.verifiedIdSignatures ?? {};
  const nextSignatures: Record<string, VerifiedIdSignature> = {};
  const workIds = new Set<string>();
  const playlistIds = new Set<string>();
  const trackIds = new Set<string>();
  let recomputedAny = false;
  const fail = (): HasCompleteUniqueIdsResult => ({ ok: false, signaturesChanged: false });

  for (const path of paths) {
    checkpoint();
    const key = pathKey(portableRelative(root, path), platform);
    const stat = statSizeAndMtime(path);
    if (!stat) return fail();
    const cached = previousSignatures[key];
    if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
      if (
        workIds.has(cached.workId) ||
        cached.playlistIds.some((id) => playlistIds.has(id)) ||
        cached.trackIds.some((id) => trackIds.has(id))
      ) {
        return fail();
      }
      workIds.add(cached.workId);
      for (const id of cached.playlistIds) playlistIds.add(id);
      for (const id of cached.trackIds) trackIds.add(id);
      nextSignatures[key] = cached;
      continue;
    }

    onIdSignatureMiss();
    const raw = parseObject(readFileSync(path, "utf-8"));
    checkpoint();
    const playlists = raw ? playlistsOf(raw) : null;
    if (!raw || !playlists || typeof raw.id !== "string" || workIds.has(raw.id)) return fail();
    const operations = operationsByPath.get(key);
    let latestCompletedOperation: MigrationOperation | undefined;
    for (let index = (operations?.length ?? 0) - 1; index >= 0; index--) {
      checkpoint();
      if (operations![index]!.completed) {
        latestCompletedOperation = operations![index];
        break;
      }
    }
    if (
      latestCompletedOperation?.originalAssignment &&
      idsMatchAssignment(raw, playlists, latestCompletedOperation.originalAssignment)
    ) {
      return fail();
    }
    workIds.add(raw.id);
    if ("defaultPlaylist" in raw) return fail();
    if (raw.defaultPlaylistId !== null && typeof raw.defaultPlaylistId !== "string") return fail();
    let hasDefaultPlaylist = raw.defaultPlaylistId === null;
    const playlistIdList: string[] = [];
    const trackIdList: string[] = [];
    for (const playlist of playlists) {
      checkpoint();
      if (
        typeof playlist.id !== "string" ||
        !UUID_V4_PATTERN.test(playlist.id) ||
        playlistIds.has(playlist.id)
      ) {
        return fail();
      }
      playlistIds.add(playlist.id);
      playlistIdList.push(playlist.id);
      if (playlist.id === raw.defaultPlaylistId) hasDefaultPlaylist = true;
      for (const track of playlist.tracks as JsonObject[]) {
        checkpoint();
        if (
          typeof track.id !== "string" ||
          !UUID_V4_PATTERN.test(track.id) ||
          trackIds.has(track.id)
        ) {
          return fail();
        }
        trackIds.add(track.id);
        trackIdList.push(track.id);
      }
    }
    if (!hasDefaultPlaylist) return fail();
    nextSignatures[key] = {
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      workId: raw.id,
      playlistIds: playlistIdList,
      trackIds: trackIdList,
    };
    recomputedAny = true;
  }

  const signaturesChanged =
    recomputedAny || Object.keys(nextSignatures).length !== Object.keys(previousSignatures).length;
  manifest.verifiedIdSignatures = nextSignatures;
  return { ok: true, signaturesChanged };
}

function assignmentOf(raw: JsonObject, playlists: JsonObject[]): IdAssignment {
  return {
    workId: raw.id as string,
    playlistIds: playlists.map((playlist) => playlist.id as string),
    trackIds: playlists.map((playlist) =>
      (playlist.tracks as JsonObject[]).map((track) => track.id as string),
    ),
    defaultPlaylistId: typeof raw.defaultPlaylistId === "string" ? raw.defaultPlaylistId : null,
  };
}

function applyAssignment(raw: JsonObject, assignment: IdAssignment): boolean {
  const playlists = playlistsOf(raw);
  if (!playlists || playlists.length !== assignment.playlistIds.length) return false;
  raw.id = assignment.workId;
  for (let playlistIndex = 0; playlistIndex < playlists.length; playlistIndex++) {
    const playlist = playlists[playlistIndex]!;
    const tracks = playlist.tracks as JsonObject[];
    const trackIds = assignment.trackIds[playlistIndex];
    if (!trackIds || tracks.length !== trackIds.length) return false;
    playlist.id = assignment.playlistIds[playlistIndex]!;
    for (let trackIndex = 0; trackIndex < tracks.length; trackIndex++) {
      tracks[trackIndex]!.id = trackIds[trackIndex]!;
    }
  }
  raw.defaultPlaylistId = assignment.defaultPlaylistId;
  delete raw.defaultPlaylist;
  return true;
}

function readManifest(
  path: string,
  root: string,
  checkpoint: () => void = () => {},
): MigrationManifest {
  checkpoint();
  if (!existsSync(path)) {
    return { version: 1, libraryRoot: root, libraryCompleted: false, operations: [] };
  }
  const value: unknown = JSON.parse(readFileSync(path, "utf-8"));
  checkpoint();
  if (
    typeof value !== "object" ||
    value === null ||
    (value as MigrationManifest).version !== 1 ||
    (value as MigrationManifest).libraryRoot !== root ||
    !Array.isArray((value as MigrationManifest).operations)
  ) {
    throw new Error(`Playlist/Track ID移行manifestが不正です: ${path}`);
  }
  const manifest = value as MigrationManifest;
  manifest.libraryCompleted ??= false;
  return manifest;
}

function ensureBackup(path: string, content: string, checkpoint: () => void = () => {}): void {
  checkpoint();
  if (existsSync(path)) {
    if (sha256(readFileSync(path, "utf-8")) !== sha256(content)) {
      throw new Error(`メタ移行バックアップの内容が一致しません: ${path}`);
    }
    checkpoint();
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  checkpoint();
  const temporary = join(dirname(path), `.${basename(path)}.${crypto.randomUUID()}.tmp`);
  writeFileSync(temporary, content, "utf-8");
  try {
    checkpoint();
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
  renameSync(temporary, path);
  checkpoint();
}

/** strictなメタ読込より前に、旧メタと重複IDを保全付きで一括移行する。 */
export function migrateMetaIds(options: MetaIdMigrationOptions): MetaIdMigrationResult {
  const checkpoint = options.throwIfCancelled ?? (() => {});
  checkpoint();
  const platform = options.platform ?? process.platform;
  const rootKey = sha256(options.root).slice(0, 16);
  const migrationRoot = join(options.dataRoot, "migrations", "playlist-track-ids", rootKey);
  const manifestPath = join(migrationRoot, "manifest.json");
  checkpoint();
  const manifest = readManifest(manifestPath, options.root, checkpoint);
  checkpoint();
  const operationsByPath = new Map<string, MigrationOperation[]>();
  for (const operation of manifest.operations) {
    checkpoint();
    const key = pathKey(operation.relativePath, platform);
    const operations = operationsByPath.get(key);
    if (operations) operations.push(operation);
    else operationsByPath.set(key, [operation]);
  }
  const paths = [...options.metaPaths].sort((a, b) =>
    stableCompare(
      pathKey(portableRelative(options.root, a), platform),
      pathKey(portableRelative(options.root, b), platform),
    ),
  );
  if (manifest.libraryCompleted) {
    const fastCheck = hasCompleteUniqueIds(
      paths,
      options.root,
      platform,
      operationsByPath,
      manifest,
      checkpoint,
      options.onIdSignatureMiss,
    );
    if (fastCheck.signaturesChanged) {
      checkpoint();
      writeJsonAtomic(manifestPath, manifest, checkpoint);
    }
    if (fastCheck.ok) {
      checkpoint();
      return { migrated: 0, alreadyMigrated: 0, externallyModified: [] };
    }
  }

  let manifestChanged = manifest.libraryCompleted;
  manifest.libraryCompleted = false;
  const hashMeta = (content: string): string => {
    options.onMetaHash?.();
    return sha256(content);
  };
  const seenWorkIds = new Set<string>();
  const seenPlaylistIds = new Set<string>();
  const seenTrackIds = new Set<string>();
  const pending: Array<{
    path: string;
    output: string;
    operation: MigrationOperation;
  }> = [];
  const externallyModified: string[] = [];
  let alreadyMigrated = 0;

  for (const path of paths) {
    checkpoint();
    const relativePath = portableRelative(options.root, path);
    const content = readFileSync(path, "utf-8");
    checkpoint();
    const currentHash = hashMeta(content);
    const key = pathKey(relativePath, platform);
    const pathOperations = operationsByPath.get(key) ?? [];
    const unfinishedOperations = pathOperations.filter((operation) => !operation.completed);
    // 完了済み操作でも元ハッシュへ戻っていれば、保存済みの採番をそのまま再適用する。
    const pendingOperation = [...pathOperations]
      .reverse()
      .find((operation) => operation.originalHash === currentHash);
    const migratedOperation = [...pathOperations]
      .reverse()
      .find((operation) => operation.migratedHash === currentHash);
    if (pendingOperation?.completed) {
      pendingOperation.completed = false;
      manifestChanged = true;
    }
    if (migratedOperation && !migratedOperation.completed) {
      migratedOperation.completed = true;
      manifestChanged = true;
      alreadyMigrated += 1;
    }
    if (unfinishedOperations.length > 0 && !pendingOperation && !migratedOperation) {
      externallyModified.push(relativePath);
    }

    const raw = parseObject(content);
    const playlists = raw ? playlistsOf(raw) : null;
    if (!raw || !playlists || typeof raw.id !== "string") continue;
    const originalAssignment = completeAssignmentOf(raw, playlists);

    const initialDefaultPlaylistId =
      typeof raw.defaultPlaylistId === "string" ? raw.defaultPlaylistId : null;
    const legacyDefaultPlaylistName =
      typeof raw.defaultPlaylist === "string" ? raw.defaultPlaylist : null;
    const defaultPlaylistIndex = playlists.findIndex((playlist) =>
      initialDefaultPlaylistId !== null
        ? playlist.id === initialDefaultPlaylistId
        : legacyDefaultPlaylistName !== null && playlist.name === legacyDefaultPlaylistName,
    );

    if (pendingOperation && !applyAssignment(raw, pendingOperation)) {
      externallyModified.push(relativePath);
      continue;
    }

    let changed = pendingOperation !== undefined;
    if (!pendingOperation && !migratedOperation && unfinishedOperations.length > 0) {
      // manifest記録後に外部編集されたファイルは所有IDとして読むだけで、書き換えない。
      for (const playlist of playlists) {
        checkpoint();
        if (typeof playlist.id === "string") seenPlaylistIds.add(playlist.id);
        for (const track of playlist.tracks as JsonObject[]) {
          checkpoint();
          if (typeof track.id === "string") seenTrackIds.add(track.id);
        }
      }
      seenWorkIds.add(raw.id as string);
      continue;
    }

    if (seenWorkIds.has(raw.id)) {
      raw.id = crypto.randomUUID();
      for (const playlist of playlists) {
        checkpoint();
        playlist.id = crypto.randomUUID();
        for (const track of playlist.tracks as JsonObject[]) {
          checkpoint();
          track.id = crypto.randomUUID();
        }
      }
      changed = true;
    }
    seenWorkIds.add(raw.id as string);

    for (const playlist of playlists) {
      checkpoint();
      if (typeof playlist.id !== "string" || seenPlaylistIds.has(playlist.id)) {
        playlist.id = crypto.randomUUID();
        changed = true;
      }
      seenPlaylistIds.add(playlist.id as string);
      for (const track of playlist.tracks as JsonObject[]) {
        checkpoint();
        if (typeof track.id !== "string" || seenTrackIds.has(track.id)) {
          track.id = crypto.randomUUID();
          changed = true;
        }
        seenTrackIds.add(track.id as string);
      }
    }

    const resolvedDefaultPlaylistId =
      defaultPlaylistIndex >= 0 ? (playlists[defaultPlaylistIndex]!.id as string) : null;
    if (raw.defaultPlaylistId !== resolvedDefaultPlaylistId || "defaultPlaylist" in raw) {
      raw.defaultPlaylistId = resolvedDefaultPlaylistId;
      changed = true;
    }
    delete raw.defaultPlaylist;

    const parsed = metaFileSchema.safeParse(raw);
    if (!parsed.success) continue;
    const output = serialize(raw);
    if (!changed) continue;

    if (pendingOperation) {
      if (hashMeta(output) !== pendingOperation.migratedHash) {
        throw new Error(`保存済み採番結果を再現できません: ${relativePath}`);
      }
      pending.push({ path, output, operation: pendingOperation });
      continue;
    }

    const operation: MigrationOperation = {
      relativePath,
      originalHash: currentHash,
      migratedHash: hashMeta(output),
      originalAssignment,
      completed: false,
      ...assignmentOf(raw, playlists),
    };
    manifest.operations.push(operation);
    const operations = operationsByPath.get(key);
    if (operations) operations.push(operation);
    else operationsByPath.set(key, [operation]);
    manifestChanged = true;
    pending.push({ path, output, operation });
  }

  // 採番結果と未完了状態はメタを書き換える前に必ず永続化する。
  if (manifestChanged) {
    checkpoint();
    writeJsonAtomic(manifestPath, manifest, checkpoint);
    checkpoint();
    manifestChanged = false;
  }

  let migrated = 0;
  let completedSinceFlush = 0;
  let stoppedEarly = false;
  for (const item of pending) {
    checkpoint();
    if (options.maxWrites !== undefined && migrated >= options.maxWrites) {
      stoppedEarly = true;
      break;
    }
    const current = readFileSync(item.path, "utf-8");
    checkpoint();
    const currentHash = hashMeta(current);
    if (currentHash === item.operation.migratedHash) {
      alreadyMigrated += 1;
      item.operation.completed = true;
      completedSinceFlush += 1;
      continue;
    }
    if (currentHash !== item.operation.originalHash) {
      externallyModified.push(item.operation.relativePath);
      continue;
    }
    const backupPath = join(
      migrationRoot,
      "backup",
      item.operation.originalHash,
      item.operation.relativePath,
    );
    ensureBackup(backupPath, current, checkpoint);
    checkpoint();
    const temporary = join(
      dirname(item.path),
      `.${basename(item.path)}.${crypto.randomUUID()}.tmp`,
    );
    writeFileSync(temporary, item.output, "utf-8");
    try {
      checkpoint();
    } catch (error) {
      rmSync(temporary, { force: true });
      throw error;
    }
    options.beforeFinalHashCheck?.(item.path);
    try {
      checkpoint();
    } catch (error) {
      rmSync(temporary, { force: true });
      throw error;
    }
    const hashImmediatelyBeforeRename = hashMeta(readFileSync(item.path, "utf-8"));
    try {
      checkpoint();
    } catch (error) {
      rmSync(temporary, { force: true });
      throw error;
    }
    if (hashImmediatelyBeforeRename !== item.operation.originalHash) {
      rmSync(temporary, { force: true });
      externallyModified.push(item.operation.relativePath);
      continue;
    }
    // Nodeの標準APIでは別プロセスの書込みをrenameと排他的にできないため、再ハッシュ後にも
    // ごく短い競合窓は残る。検証をrename直前へ置き、上書き可能な時間を最小化する。
    renameSync(temporary, item.path);
    checkpoint();
    item.operation.completed = true;
    completedSinceFlush += 1;
    migrated += 1;
    if (completedSinceFlush >= 100) {
      checkpoint();
      writeJsonAtomic(manifestPath, manifest, checkpoint);
      checkpoint();
      completedSinceFlush = 0;
    }
  }

  const migrationFullyApplied =
    !stoppedEarly &&
    externallyModified.length === 0 &&
    manifest.operations.every((operation) => operation.completed);
  let canMarkLibraryCompleted = false;
  if (migrationFullyApplied) {
    const finalCheck = hasCompleteUniqueIds(
      paths,
      options.root,
      platform,
      operationsByPath,
      manifest,
      checkpoint,
      options.onIdSignatureMiss,
    );
    canMarkLibraryCompleted = finalCheck.ok;
    if (finalCheck.signaturesChanged) manifestChanged = true;
  }
  if (manifest.libraryCompleted !== canMarkLibraryCompleted) {
    manifest.libraryCompleted = canMarkLibraryCompleted;
    manifestChanged = true;
  }
  checkpoint();
  if (completedSinceFlush > 0 || manifestChanged) {
    writeJsonAtomic(manifestPath, manifest, checkpoint);
  }
  checkpoint();

  return {
    migrated,
    alreadyMigrated,
    externallyModified: [...new Set(externallyModified)].sort(stableCompare),
  };
}
