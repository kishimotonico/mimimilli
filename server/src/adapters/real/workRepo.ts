// works / tags / smart_folders / search_presets / app_settings の CRUD と行⇄ドメイン変換。
// 検索・絞り込みは core/worksQuery（インメモリ）で行うため、ここは取得と更新に徹する。
import { asc, eq, inArray, notInArray } from "drizzle-orm";
import {
  dlsiteStateSchema,
  emptyDlsiteState,
  normalizeTags,
  playlistSchema,
  searchPresetSchema,
  smartFolderSchema,
  workSchema,
  workSummarySchema,
} from "@mimimilli/shared";
import type {
  DlsiteState,
  Playlist,
  SearchPreset,
  SearchPresetCreate,
  SmartFolder,
  SmartFolderCreate,
  SmartFolderUpdate,
  TagPrefix,
  TagPrefixCreate,
  TagPrefixUpdate,
  Work,
  WorkSummary,
  UrlEntry,
} from "@mimimilli/shared";
import { z } from "zod";
import type { Db } from "./db.ts";
import {
  appSettings,
  searchPresets,
  smartFolders,
  tagPrefixes,
  tags,
  workDlsite,
  workTags,
  works,
} from "./schema.ts";

type WorkRow = typeof works.$inferSelect;

export class PersistentDataError extends Error {
  constructor(table: string, recordId: string | number, detail: string) {
    super(`SQLite の ${table} レコード "${recordId}" が不正です: ${detail}`);
    this.name = "PersistentDataError";
  }
}

function parseJsonField(
  raw: string,
  table: string,
  recordId: string | number,
  field: string,
): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PersistentDataError(table, recordId, `${field}: JSON パースエラー: ${message}`);
  }
}

function parseRecord<T>(
  schema: z.ZodType<T>,
  value: unknown,
  table: string,
  recordId: string | number,
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const detail = result.error.issues
    .map((issue) => `${issue.path.join(".") || "(record)"}: ${issue.message}`)
    .join("; ");
  throw new PersistentDataError(table, recordId, detail);
}

function defaultPlaylistOf(
  row: Pick<WorkRow, "id" | "defaultPlaylist">,
  playlists: Playlist[],
): Playlist | null {
  if (playlists.length === 0) return null;
  if (row.defaultPlaylist) {
    const playlist = playlists.find((p) => p.name === row.defaultPlaylist);
    if (!playlist) {
      throw new PersistentDataError(
        "works",
        row.id,
        `defaultPlaylist: playlists_json に "${row.defaultPlaylist}" がありません`,
      );
    }
    return playlist;
  }
  return playlists[0]!;
}

function rowToSummary(row: WorkRow, tagNames: string[], dlsite: DlsiteState): WorkSummary {
  const playlists = parseRecord(
    z.array(playlistSchema),
    parseJsonField(row.playlistsJson, "works", row.id, "playlists_json"),
    "works",
    row.id,
  );
  return parseRecord(
    workSummarySchema,
    {
      id: row.id,
      title: row.title,
      coverImage: row.coverImage,
      status: row.status,
      physicalPath: row.physicalPath,
      totalDurationSec: row.totalDurationSec,
      addedAt: row.addedAt,
      errorMessage: row.errorMessage,
      urls: parseJsonField(row.urlsJson, "works", row.id, "urls_json"),
      tags: tagNames,
      trackCount: defaultPlaylistOf(row, playlists)?.tracks.length ?? 0,
      bookmarked: row.bookmarked,
      lastPlayedAt: row.lastPlayedAt,
      dlsite,
    },
    "works",
    row.id,
  );
}

function rowToWork(row: WorkRow, tagNames: string[], dlsite: DlsiteState): Work {
  return parseRecord(
    workSchema,
    {
      id: row.id,
      title: row.title,
      coverImage: row.coverImage,
      status: row.status,
      physicalPath: row.physicalPath,
      totalDurationSec: row.totalDurationSec,
      addedAt: row.addedAt,
      errorMessage: row.errorMessage,
      urls: parseJsonField(row.urlsJson, "works", row.id, "urls_json"),
      tags: tagNames,
      defaultPlaylist: row.defaultPlaylist,
      createdAt: row.createdAt,
      playlists: parseJsonField(row.playlistsJson, "works", row.id, "playlists_json"),
      bookmarked: row.bookmarked,
      lastPlayedAt: row.lastPlayedAt,
      resumePosition: row.resumePosition,
      resumeTrackIndex: row.resumeTrackIndex,
      dlsite,
    },
    "works",
    row.id,
  );
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
    // DB キャッシュには常に正規形で入れる（ADR-0005 決定5）。メタファイル側の正規化は
    // 編集経路（PATCH / DLsite 適用）で行い、スキャン取り込みはメタを書き換えない
    for (const name of normalizeTags(tagNames)) {
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

  private dlsiteState(workId: string): DlsiteState {
    const row = this.db.select().from(workDlsite).where(eq(workDlsite.workId, workId)).get();
    if (!row) return emptyDlsiteState();
    return parseRecord(
      dlsiteStateSchema,
      parseJsonField(row.stateJson, "work_dlsite", workId, "state_json"),
      "work_dlsite",
      workId,
    );
  }

  setDlsiteState(workId: string, state: DlsiteState): void {
    this.db
      .insert(workDlsite)
      .values({ workId, stateJson: JSON.stringify(state) })
      .onConflictDoUpdate({
        target: workDlsite.workId,
        set: { stateJson: JSON.stringify(state) },
      })
      .run();
  }

  listSummaries(): WorkSummary[] {
    const rows = this.db.select().from(works).all();
    const tagsByWork = this.tagMap();
    return rows.map((row) =>
      rowToSummary(row, tagsByWork.get(row.id) ?? [], this.dlsiteState(row.id)),
    );
  }

  getWork(id: string): Work | null {
    const row = this.db.select().from(works).where(eq(works.id, id)).get();
    if (!row) return null;
    return rowToWork(row, this.tagMap([id]).get(id) ?? [], this.dlsiteState(id));
  }

  getWorkByPhysicalPath(physicalPath: string): Work | null {
    const row = this.db.select().from(works).where(eq(works.physicalPath, physicalPath)).get();
    if (!row) return null;
    return rowToWork(row, this.tagMap([row.id]).get(row.id) ?? [], this.dlsiteState(row.id));
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
      urlsJson: JSON.stringify(work.urls),
      playlistsJson: JSON.stringify(work.playlists),
      bookmarked: work.bookmarked,
      lastPlayedAt: work.lastPlayedAt,
      resumePosition: work.resumePosition,
      resumeTrackIndex: work.resumeTrackIndex,
    };
    this.db
      .insert(works)
      .values(values)
      .onConflictDoUpdate({ target: works.id, set: values })
      .run();
    this.replaceWorkTags(work.id, work.tags);
    this.setDlsiteState(work.id, work.dlsite);
  }

  /** PATCH /works/:id および DLsite 適用の DB 側。メタファイル書き戻しは呼び出し側（アダプタ）が行う */
  patchWork(
    id: string,
    patch: {
      title?: string;
      tags?: string[];
      bookmarked?: boolean;
      coverImage?: string;
      urls?: UrlEntry[];
    },
  ): Work | null {
    const row = this.db.select().from(works).where(eq(works.id, id)).get();
    if (!row) return null;
    const set: Partial<typeof works.$inferInsert> = {};
    if (patch.title !== undefined) set.title = patch.title;
    if (patch.bookmarked !== undefined) set.bookmarked = patch.bookmarked;
    if (patch.coverImage !== undefined) set.coverImage = patch.coverImage;
    if (patch.urls !== undefined) set.urlsJson = JSON.stringify(patch.urls);
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
    return this.db.select({ id: works.id }).from(works).where(eq(works.status, status)).all()
      .length;
  }

  // ── タグ prefix 定義（ADR-0005）───────────────────────────

  listTagPrefixes(): TagPrefix[] {
    return this.db
      .select()
      .from(tagPrefixes)
      .orderBy(asc(tagPrefixes.id))
      .all()
      .map((r) => ({
        prefix: r.prefix,
        label: r.label,
        color: r.color,
        showAsAxis: r.showAsAxis,
        protected: r.protected,
      }));
  }

  getTagPrefix(prefix: string): TagPrefix | null {
    const r = this.db.select().from(tagPrefixes).where(eq(tagPrefixes.prefix, prefix)).get();
    if (!r) return null;
    return {
      prefix: r.prefix,
      label: r.label,
      color: r.color,
      showAsAxis: r.showAsAxis,
      protected: r.protected,
    };
  }

  /** 既に存在する prefix なら null（呼び出し側で 409 にする） */
  createTagPrefix(input: TagPrefixCreate): TagPrefix | null {
    const r = this.db
      .insert(tagPrefixes)
      .values({
        prefix: input.prefix,
        label: input.label,
        color: input.color,
        showAsAxis: input.showAsAxis,
        protected: input.protected,
      })
      .onConflictDoNothing()
      .run();
    if (r.changes === 0) return null;
    return this.getTagPrefix(input.prefix);
  }

  updateTagPrefix(prefix: string, patch: TagPrefixUpdate): TagPrefix | null {
    const existing = this.getTagPrefix(prefix);
    if (!existing) return null;
    const set: Partial<typeof tagPrefixes.$inferInsert> = {};
    if (patch.label !== undefined) set.label = patch.label;
    if (patch.color !== undefined) set.color = patch.color;
    if (patch.showAsAxis !== undefined) set.showAsAxis = patch.showAsAxis;
    if (patch.protected !== undefined) set.protected = patch.protected;
    if (Object.keys(set).length > 0) {
      this.db.update(tagPrefixes).set(set).where(eq(tagPrefixes.prefix, prefix)).run();
    }
    return this.getTagPrefix(prefix);
  }

  deleteTagPrefix(prefix: string): boolean {
    return this.db.delete(tagPrefixes).where(eq(tagPrefixes.prefix, prefix)).run().changes > 0;
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
      .map((r) =>
        parseRecord(
          smartFolderSchema,
          {
            id: r.id,
            name: r.name,
            rules: parseJsonField(r.rulesJson, "smart_folders", r.id, "rules_json"),
            sort: r.sort,
            createdAt: r.createdAt,
          },
          "smart_folders",
          r.id,
        ),
      );
  }

  getSmartFolder(id: string): SmartFolder | null {
    const r = this.db.select().from(smartFolders).where(eq(smartFolders.id, id)).get();
    if (!r) return null;
    return parseRecord(
      smartFolderSchema,
      {
        id: r.id,
        name: r.name,
        rules: parseJsonField(r.rulesJson, "smart_folders", r.id, "rules_json"),
        sort: r.sort,
        createdAt: r.createdAt,
      },
      "smart_folders",
      r.id,
    );
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
      .values({
        id: folder.id,
        name: folder.name,
        rulesJson: JSON.stringify(folder.rules),
        sort: folder.sort,
        createdAt: folder.createdAt,
      })
      .run();
    return folder;
  }

  updateSmartFolder(id: string, input: SmartFolderUpdate): SmartFolder | null {
    const existing = this.getSmartFolder(id);
    if (!existing) return null;
    const set: Partial<typeof smartFolders.$inferInsert> = {};
    if (input.name !== undefined) set.name = input.name;
    if (input.rules !== undefined) set.rulesJson = JSON.stringify(input.rules);
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
      .map((r) =>
        parseRecord(
          searchPresetSchema,
          {
            id: r.id,
            name: r.name,
            query: r.query,
            tagFilters: parseJsonField(
              r.tagFiltersJson,
              "search_presets",
              r.id,
              "tag_filters_json",
            ),
            sortId: r.sortId,
          },
          "search_presets",
          r.id,
        ),
      );
  }

  createPreset(input: SearchPresetCreate): SearchPreset {
    const r = this.db
      .insert(searchPresets)
      .values({
        name: input.name,
        query: input.query,
        tagFiltersJson: JSON.stringify(input.tagFilters),
        sortId: input.sortId,
      })
      .run();
    return {
      id: Number(r.lastInsertRowid),
      name: input.name,
      query: input.query,
      tagFilters: input.tagFilters,
      sortId: input.sortId,
    };
  }

  deletePreset(id: number): boolean {
    return this.db.delete(searchPresets).where(eq(searchPresets.id, id)).run().changes > 0;
  }
}
