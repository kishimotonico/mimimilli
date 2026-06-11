// works / tags / smart_folders / search_presets / app_settings の CRUD と行⇄ドメイン変換。
// 検索・絞り込みは core/worksQuery（インメモリ）で行うため、ここは取得と更新に徹する。
import { asc, eq, inArray, notInArray } from "drizzle-orm";
import type {
  Playlist,
  SearchPreset,
  SearchPresetCreate,
  SmartFolder,
  SmartFolderCreate,
  SmartFolderUpdate,
  SortId,
  Work,
  WorkStatus,
  WorkSummary,
  UrlEntry,
} from "@mimikago/shared";
import type { Db } from "./db.ts";
import { appSettings, searchPresets, smartFolders, tags, workTags, works } from "./schema.ts";

type WorkRow = typeof works.$inferSelect;

function defaultPlaylistOf(row: WorkRow): Playlist | null {
  if (row.playlistsJson.length === 0) return null;
  if (row.defaultPlaylist) {
    const playlist = row.playlistsJson.find((p) => p.name === row.defaultPlaylist);
    if (!playlist) {
      throw new Error(`DB の defaultPlaylist が不正です: ${row.id}/${row.defaultPlaylist}`);
    }
    return playlist;
  }
  return row.playlistsJson[0]!;
}

function rowToSummary(row: WorkRow, tagNames: string[]): WorkSummary {
  return {
    id: row.id,
    title: row.title,
    coverImage: row.coverImage,
    status: row.status as WorkStatus,
    physicalPath: row.physicalPath,
    totalDurationSec: row.totalDurationSec,
    addedAt: row.addedAt,
    errorMessage: row.errorMessage,
    urls: row.urlsJson,
    tags: tagNames,
    trackCount: defaultPlaylistOf(row)?.tracks.length ?? 0,
    bookmarked: row.bookmarked,
    lastPlayedAt: row.lastPlayedAt,
  };
}

function rowToWork(row: WorkRow, tagNames: string[]): Work {
  return {
    id: row.id,
    title: row.title,
    coverImage: row.coverImage,
    status: row.status as WorkStatus,
    physicalPath: row.physicalPath,
    totalDurationSec: row.totalDurationSec,
    addedAt: row.addedAt,
    errorMessage: row.errorMessage,
    urls: row.urlsJson,
    tags: tagNames,
    defaultPlaylist: row.defaultPlaylist,
    createdAt: row.createdAt,
    playlists: row.playlistsJson,
    bookmarked: row.bookmarked,
    lastPlayedAt: row.lastPlayedAt,
    resumePosition: row.resumePosition,
    resumeTrackIndex: row.resumeTrackIndex,
  };
}

export class WorkRepo {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  // ── タグ ──────────────────────────────────────────────────

  /** workId → タグ名一覧のマップを作る（対象未指定なら全件） */
  private tagMap(workIds?: string[]): Map<string, string[]> {
    const rows =
      workIds === undefined
        ? this.db
            .select({ workId: workTags.workId, name: tags.name })
            .from(workTags)
            .innerJoin(tags, eq(workTags.tagId, tags.id))
            .all()
        : workIds.length === 0
          ? []
          : this.db
              .select({ workId: workTags.workId, name: tags.name })
              .from(workTags)
              .innerJoin(tags, eq(workTags.tagId, tags.id))
              .where(inArray(workTags.workId, workIds))
              .all();
    const map = new Map<string, string[]>();
    for (const r of rows) {
      const list = map.get(r.workId);
      if (list) list.push(r.name);
      else map.set(r.workId, [r.name]);
    }
    return map;
  }

  private replaceWorkTags(workId: string, tagNames: string[]): void {
    this.db.delete(workTags).where(eq(workTags.workId, workId)).run();
    for (const name of tagNames) {
      this.db.insert(tags).values({ name }).onConflictDoNothing().run();
      const tag = this.db.select().from(tags).where(eq(tags.name, name)).get();
      if (tag) {
        this.db.insert(workTags).values({ workId, tagId: tag.id }).onConflictDoNothing().run();
      }
    }
  }

  listAllTagNames(): string[] {
    // 作品に紐づいているタグのみ（孤児タグは出さない）
    return this.db
      .selectDistinct({ name: tags.name })
      .from(tags)
      .innerJoin(workTags, eq(workTags.tagId, tags.id))
      .orderBy(asc(tags.name))
      .all()
      .map((r) => r.name);
  }

  // ── works ─────────────────────────────────────────────────

  listSummaries(): WorkSummary[] {
    const rows = this.db.select().from(works).all();
    const tagsByWork = this.tagMap();
    return rows.map((row) => rowToSummary(row, tagsByWork.get(row.id) ?? []));
  }

  getWork(id: string): Work | null {
    const row = this.db.select().from(works).where(eq(works.id, id)).get();
    if (!row) return null;
    return rowToWork(row, this.tagMap([id]).get(id) ?? []);
  }

  getWorkByPhysicalPath(physicalPath: string): Work | null {
    const row = this.db.select().from(works).where(eq(works.physicalPath, physicalPath)).get();
    if (!row) return null;
    return rowToWork(row, this.tagMap([row.id]).get(row.id) ?? []);
  }

  /** scan からの登録。タグも置き換える */
  upsertWork(work: Work): void {
    const values = {
      id: work.id,
      title: work.title,
      coverImage: work.coverImage,
      defaultPlaylist: work.defaultPlaylist,
      createdAt: work.createdAt,
      status: work.status,
      physicalPath: work.physicalPath,
      totalDurationSec: work.totalDurationSec,
      addedAt: work.addedAt,
      errorMessage: work.errorMessage,
      urlsJson: work.urls,
      playlistsJson: work.playlists,
      bookmarked: work.bookmarked,
      lastPlayedAt: work.lastPlayedAt,
      resumePosition: work.resumePosition,
      resumeTrackIndex: work.resumeTrackIndex,
    };
    this.db.insert(works).values(values).onConflictDoUpdate({ target: works.id, set: values }).run();
    this.replaceWorkTags(work.id, work.tags);
  }

  /** PATCH /works/:id および DLsite 適用の DB 側。メタファイル書き戻しは呼び出し側（アダプタ）が行う */
  patchWork(
    id: string,
    patch: { title?: string; tags?: string[]; bookmarked?: boolean; coverImage?: string; urls?: UrlEntry[] }
  ): Work | null {
    const row = this.db.select().from(works).where(eq(works.id, id)).get();
    if (!row) return null;
    const set: Partial<typeof works.$inferInsert> = {};
    if (patch.title !== undefined) set.title = patch.title;
    if (patch.bookmarked !== undefined) set.bookmarked = patch.bookmarked;
    if (patch.coverImage !== undefined) set.coverImage = patch.coverImage;
    if (patch.urls !== undefined) set.urlsJson = patch.urls;
    if (Object.keys(set).length > 0) {
      this.db.update(works).set(set).where(eq(works.id, id)).run();
    }
    if (patch.tags !== undefined) {
      this.replaceWorkTags(id, patch.tags);
    }
    return this.getWork(id);
  }

  saveResume(id: string, position: number, trackIndex: number): boolean {
    const r = this.db
      .update(works)
      .set({ resumePosition: position, resumeTrackIndex: trackIndex })
      .where(eq(works.id, id))
      .run();
    return r.changes > 0;
  }

  touchLastPlayed(id: string): boolean {
    const r = this.db
      .update(works)
      .set({ lastPlayedAt: new Date().toISOString() })
      .where(eq(works.id, id))
      .run();
    return r.changes > 0;
  }

  markWorkError(id: string, physicalPath: string, errorMessage: string): boolean {
    return (
      this.db
        .update(works)
        .set({ status: "error", physicalPath, errorMessage })
        .where(eq(works.id, id))
        .run().changes > 0
    );
  }

  markMissingExcept(foundIds: string[]): void {
    const set = { status: "missing", errorMessage: null } as const;
    if (foundIds.length === 0) {
      this.db.update(works).set(set).run();
      return;
    }
    this.db.update(works).set(set).where(notInArray(works.id, foundIds)).run();
  }

  countByStatus(status: string): number {
    return this.db.select({ id: works.id }).from(works).where(eq(works.status, status)).all().length;
  }

  // ── app_settings（KVストア）──────────────────────────────

  getSetting(key: string): string | null {
    const row = this.db.select().from(appSettings).where(eq(appSettings.key, key)).get();
    return row?.value ?? null;
  }

  setSetting(key: string, value: string | null): void {
    this.db
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value } })
      .run();
  }

  // ── スマートフォルダー ─────────────────────────────────────

  listSmartFolders(): SmartFolder[] {
    return this.db
      .select()
      .from(smartFolders)
      .orderBy(asc(smartFolders.createdAt))
      .all()
      .map((r) => ({ id: r.id, name: r.name, rules: r.rulesJson, sort: r.sort as SortId, createdAt: r.createdAt }));
  }

  getSmartFolder(id: string): SmartFolder | null {
    const r = this.db.select().from(smartFolders).where(eq(smartFolders.id, id)).get();
    if (!r) return null;
    return { id: r.id, name: r.name, rules: r.rulesJson, sort: r.sort as SortId, createdAt: r.createdAt };
  }

  createSmartFolder(input: SmartFolderCreate): SmartFolder {
    const folder: SmartFolder = {
      id: `sf-${crypto.randomUUID()}`,
      name: input.name,
      rules: input.rules,
      sort: input.sort,
      createdAt: new Date().toISOString(),
    };
    this.db
      .insert(smartFolders)
      .values({ id: folder.id, name: folder.name, rulesJson: folder.rules, sort: folder.sort, createdAt: folder.createdAt })
      .run();
    return folder;
  }

  updateSmartFolder(id: string, input: SmartFolderUpdate): SmartFolder | null {
    const existing = this.getSmartFolder(id);
    if (!existing) return null;
    const set: Partial<typeof smartFolders.$inferInsert> = {};
    if (input.name !== undefined) set.name = input.name;
    if (input.rules !== undefined) set.rulesJson = input.rules;
    if (input.sort !== undefined) set.sort = input.sort;
    if (Object.keys(set).length > 0) {
      this.db.update(smartFolders).set(set).where(eq(smartFolders.id, id)).run();
    }
    return this.getSmartFolder(id);
  }

  deleteSmartFolder(id: string): boolean {
    return this.db.delete(smartFolders).where(eq(smartFolders.id, id)).run().changes > 0;
  }

  // ── 検索プリセット ─────────────────────────────────────────

  listPresets(): SearchPreset[] {
    return this.db
      .select()
      .from(searchPresets)
      .orderBy(asc(searchPresets.id))
      .all()
      .map((r) => ({ id: r.id, name: r.name, query: r.query, tagFilters: r.tagFiltersJson, sortId: r.sortId as SortId }));
  }

  createPreset(input: SearchPresetCreate): SearchPreset {
    const r = this.db
      .insert(searchPresets)
      .values({ name: input.name, query: input.query, tagFiltersJson: input.tagFilters, sortId: input.sortId })
      .run();
    return { id: Number(r.lastInsertRowid), name: input.name, query: input.query, tagFilters: input.tagFilters, sortId: input.sortId };
  }

  deletePreset(id: number): boolean {
    return this.db.delete(searchPresets).where(eq(searchPresets.id, id)).run().changes > 0;
  }
}
