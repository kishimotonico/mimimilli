import { asc, eq, gte, sql } from "drizzle-orm";
import type { z } from "zod";
import {
  conditionSchema,
  groupBySchema,
  groupSortIdSchema,
  smartFolderViolation,
  sortIdSchema,
  tagPrefixSchema,
} from "@mimimilli/shared";
import type {
  ResumeBody,
  SmartFolder,
  SmartFolderPatch,
  TagPrefix,
  TagPrefixCreate,
  TagPrefixUpdate,
  Work,
} from "@mimimilli/shared";
import { UnreadableSmartFolderError, type UnreadableFolderRow } from "../../errors.ts";
import type { SmartFolderInsert, SmartFolderUpdateResult } from "../../adapter/smartFolder.ts";
import type { Db } from "./db.ts";
import {
  appSettings,
  scanCandidateExclusions,
  smartFolders,
  tagPrefixes,
  workStates,
} from "./userSchema.ts";

export class UserWorkStateRepository {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  upsertWorkUserState(work: Work): void {
    this.db.user
      .insert(workStates)
      .values({
        workId: work.id,
        addedAt: work.addedAt,
        bookmarked: work.bookmarked,
        lastPlayedAt: work.lastPlayedAt,
        resumePlaylistId: work.resume?.playlistId ?? null,
        resumeTrackId: work.resume?.trackId ?? null,
        resumeOffsetSec: work.resume?.offsetSec ?? null,
      })
      .onConflictDoNothing()
      .run();
  }

  patchBookmarked(id: string, bookmarked: boolean): boolean {
    const r = this.db.user
      .update(workStates)
      .set({ bookmarked })
      .where(eq(workStates.workId, id))
      .returning({ id: workStates.workId })
      .get();
    return r !== undefined;
  }

  deleteWorkUserState(id: string): boolean {
    const r = this.db.user
      .delete(workStates)
      .where(eq(workStates.workId, id))
      .returning({ id: workStates.workId })
      .get();
    return r !== undefined;
  }

  saveResume(id: string, body: ResumeBody): boolean {
    const r = this.db.user
      .update(workStates)
      .set({
        resumePlaylistId: body.playlistId,
        resumeTrackId: body.trackId,
        resumeOffsetSec: body.offsetSec,
      })
      .where(eq(workStates.workId, id))
      .returning({ id: workStates.workId })
      .get();
    return r !== undefined;
  }

  touchLastPlayed(id: string): boolean {
    const r = this.db.user
      .update(workStates)
      .set({ lastPlayedAt: new Date().toISOString() })
      .where(eq(workStates.workId, id))
      .returning({ id: workStates.workId })
      .get();
    return r !== undefined;
  }

  listTagPrefixes(): TagPrefix[] {
    return this.db.user
      .select()
      .from(tagPrefixes)
      .orderBy(asc(tagPrefixes.sortOrder), asc(tagPrefixes.id))
      .all()
      .map((r) =>
        tagPrefixSchema.parse({
          prefix: r.prefix,
          label: r.label,
          color: r.color,
          protected: r.protected,
          order: r.sortOrder,
        }),
      );
  }

  getTagPrefix(prefix: string): TagPrefix | null {
    const r = this.db.user.select().from(tagPrefixes).where(eq(tagPrefixes.prefix, prefix)).get();
    if (!r) return null;
    return tagPrefixSchema.parse({
      prefix: r.prefix,
      label: r.label,
      color: r.color,
      protected: r.protected,
      order: r.sortOrder,
    });
  }

  private nextTagPrefixOrder(): number {
    const r = this.db.user.select({ sortOrder: tagPrefixes.sortOrder }).from(tagPrefixes).all();
    return r.reduce((max, row) => Math.max(max, row.sortOrder + 1), 0);
  }

  createTagPrefix(input: TagPrefixCreate): TagPrefix | null {
    const r = this.db.user
      .insert(tagPrefixes)
      .values({
        prefix: input.prefix,
        label: input.label,
        color: input.color,
        protected: input.protected,
        sortOrder: this.nextTagPrefixOrder(),
      })
      .onConflictDoNothing()
      .returning({ id: tagPrefixes.id })
      .get();
    if (!r) return null;
    return this.getTagPrefix(input.prefix);
  }

  updateTagPrefix(prefix: string, patch: TagPrefixUpdate): TagPrefix | null {
    const existing = this.getTagPrefix(prefix);
    if (!existing) return null;
    const set: Partial<typeof tagPrefixes.$inferInsert> = {};
    if (patch.label !== undefined) set.label = patch.label;
    if (patch.color !== undefined) set.color = patch.color;
    if (patch.protected !== undefined) set.protected = patch.protected;
    if (Object.keys(set).length > 0) {
      this.db.user.update(tagPrefixes).set(set).where(eq(tagPrefixes.prefix, prefix)).run();
    }
    return this.getTagPrefix(prefix);
  }

  /** 登録済み全 prefix を渡された順序でアトミックに並び替える。渡された集合が現在の
   *  登録済み prefix 集合と一致しない場合は null（部分適用はしない） */
  reorderTagPrefixes(order: string[]): TagPrefix[] | null {
    const existing = new Set(
      this.db.user
        .select({ prefix: tagPrefixes.prefix })
        .from(tagPrefixes)
        .all()
        .map((r) => r.prefix),
    );
    if (order.length !== existing.size || new Set(order).size !== order.length) return null;
    if (!order.every((prefix) => existing.has(prefix))) return null;
    this.db.userTransaction(() => {
      order.forEach((prefix, index) => {
        this.db.user
          .update(tagPrefixes)
          .set({ sortOrder: index })
          .where(eq(tagPrefixes.prefix, prefix))
          .run();
      });
    });
    return this.listTagPrefixes();
  }

  deleteTagPrefix(prefix: string): boolean {
    return (
      this.db.user
        .delete(tagPrefixes)
        .where(eq(tagPrefixes.prefix, prefix))
        .returning({ id: tagPrefixes.id })
        .get() !== undefined
    );
  }

  getUserSetting(key: string): string | null {
    const row = this.db.user.select().from(appSettings).where(eq(appSettings.key, key)).get();
    return row?.value ?? null;
  }

  setUserSetting(key: string, value: string | null): void {
    this.db.user
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value } })
      .run();
  }

  listScanCandidateExclusions(): string[] {
    return this.db.user
      .select({ path: scanCandidateExclusions.path })
      .from(scanCandidateExclusions)
      .all()
      .map((row) => row.path);
  }

  excludeScanCandidates(paths: string[]): void {
    for (const path of paths) {
      this.db.user.insert(scanCandidateExclusions).values({ path }).onConflictDoNothing().run();
    }
  }

  restoreScanCandidateExclusions(paths: string[]): void {
    for (const path of paths) {
      this.db.user
        .delete(scanCandidateExclusions)
        .where(eq(scanCandidateExclusions.path, path))
        .run();
    }
  }

  deleteUserSetting(key: string): void {
    this.db.user.delete(appSettings).where(eq(appSettings.key, key)).run();
  }

  /** 複数の設定を1トランザクションで保存する。discardScanCandidateExclusions は root の変更に使う。
   *  除外はroot相対pathのみを主キーに持ちrootを識別しないため、無関係なrootへ意図が漏れないよう全件破棄する。 */
  setUserSettings(
    values: Record<string, string>,
    options: { discardScanCandidateExclusions: boolean },
  ): void {
    this.db.userTransaction(() => {
      if (options.discardScanCandidateExclusions) {
        this.db.user.delete(scanCandidateExclusions).run();
      }
      for (const [key, value] of Object.entries(values)) this.setUserSetting(key, value);
    });
  }

  listSmartFolders(): SmartFolder[] {
    const results = this.db.user
      .select()
      .from(smartFolders)
      .orderBy(asc(smartFolders.position), asc(smartFolders.createdAt), asc(smartFolders.id))
      .all()
      .map(readSmartFolderRow);
    const unreadable = results.flatMap((result) =>
      "unreadable" in result ? [result.unreadable] : [],
    );
    if (unreadable.length > 0) throw new UnreadableSmartFolderError(unreadable, this.db.userPath);
    return results.flatMap((result) => ("row" in result ? [result.row] : []));
  }

  private toSmartFolderRow(r: typeof smartFolders.$inferSelect): SmartFolder {
    const result = readSmartFolderRow(r);
    if ("unreadable" in result) {
      throw new UnreadableSmartFolderError([result.unreadable], this.db.userPath);
    }
    return result.row;
  }

  getSmartFolder(id: string): SmartFolder | null {
    const r = this.db.user.select().from(smartFolders).where(eq(smartFolders.id, id)).get();
    return r ? this.toSmartFolderRow(r) : null;
  }

  smartFolderIds(): string[] {
    return this.db.user
      .select({ id: smartFolders.id })
      .from(smartFolders)
      .all()
      .map((r) => r.id);
  }

  /** 既にある ID は飛ばして末尾へ追加し、flagKey を立てる */
  seedSmartFolders(folders: SmartFolderInsert[], flagKey: string): void {
    this.db.userTransaction(() => {
      for (const folder of folders) this.insertSmartFolder(folder);
      this.setUserSetting(flagKey, "1");
    });
  }

  /** ID が既にあれば null。position を渡すとその位置に入れ、埋まっていればその位置以降を1つずつ後ろへ送る。省けば末尾 */
  insertSmartFolder(folder: SmartFolderInsert, position?: number): SmartFolder | null {
    return this.db.userTransaction(() => {
      const exists = this.db.user
        .select({ id: smartFolders.id })
        .from(smartFolders)
        .where(eq(smartFolders.id, folder.id))
        .get();
      if (exists) return null;
      if (position === undefined) {
        const end = this.db.user
          .select({ position: smartFolders.position })
          .from(smartFolders)
          .all()
          .reduce((max, row) => Math.max(max, row.position + 1), 0);
        return this.insertSmartFolderRow({ ...folder, position: end });
      }
      const occupied = this.db.user
        .select({ id: smartFolders.id })
        .from(smartFolders)
        .where(eq(smartFolders.position, position))
        .get();
      if (occupied) {
        this.db.user
          .update(smartFolders)
          .set({ position: sql`${smartFolders.position} + 1` })
          .where(gte(smartFolders.position, position))
          .run();
      }
      return this.insertSmartFolderRow({ ...folder, position });
    });
  }

  private insertSmartFolderRow(folder: SmartFolder): SmartFolder {
    this.db.user
      .insert(smartFolders)
      .values({
        id: folder.id,
        name: folder.name,
        conditionJson: JSON.stringify(folder.condition),
        sort: folder.sort,
        groupByJson: folder.groupBy === null ? null : JSON.stringify(folder.groupBy),
        groupSort: folder.groupSort,
        position: folder.position,
        createdAt: folder.createdAt,
      })
      .run();
    return folder;
  }

  /** 送った列だけを更新する。今の行に重ねたできあがりを同じトランザクションの中で検証し、違反なら書かない */
  updateSmartFolder(id: string, patch: SmartFolderPatch): SmartFolderUpdateResult | null {
    return this.db.userTransaction(() => {
      const existing = this.getSmartFolder(id);
      if (!existing) return null;
      const violation = smartFolderViolation({ ...existing, ...patch });
      if (violation) return { violation };
      const r = this.db.user
        .update(smartFolders)
        .set({
          ...(patch.name === undefined ? {} : { name: patch.name }),
          ...(patch.condition === undefined
            ? {}
            : { conditionJson: JSON.stringify(patch.condition) }),
          ...(patch.sort === undefined ? {} : { sort: patch.sort }),
          ...(patch.groupBy === undefined
            ? {}
            : { groupByJson: patch.groupBy === null ? null : JSON.stringify(patch.groupBy) }),
          ...(patch.groupSort === undefined ? {} : { groupSort: patch.groupSort }),
        })
        .where(eq(smartFolders.id, id))
        .returning()
        .get();
      return r ? { row: this.toSmartFolderRow(r) } : null;
    });
  }

  /** 全件の順序を置き換える。渡された集合が今の集合と一致しなければ null */
  reorderSmartFolders(ids: string[]): SmartFolder[] | null {
    return this.db.userTransaction(() => {
      const existing = new Set(
        this.db.user
          .select({ id: smartFolders.id })
          .from(smartFolders)
          .all()
          .map((r) => r.id),
      );
      if (ids.length !== existing.size || !ids.every((id) => existing.has(id))) return null;
      ids.forEach((id, position) => {
        this.db.user.update(smartFolders).set({ position }).where(eq(smartFolders.id, id)).run();
      });
      return this.listSmartFolders();
    });
  }

  deleteSmartFolder(id: string): boolean {
    return (
      this.db.user
        .delete(smartFolders)
        .where(eq(smartFolders.id, id))
        .returning({ id: smartFolders.id })
        .get() !== undefined
    );
  }
}

const VIOLATION_COLUMNS = {
  name: "name",
  condition: "condition_json",
  sort: "sort",
  groupBy: "group_by_json",
  groupSort: "group_sort",
} as const;

type ColumnProblem = UnreadableFolderRow["problems"][number];
type ColumnRead<T> = { ok: true; value: T } | { ok: false; problem: ColumnProblem };

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => (issue.path.length > 0 ? `${issue.path.join(".")}: ` : "") + issue.message)
    .join(", ");
}

function failed(column: string, reason: string): { ok: false; problem: ColumnProblem } {
  return { ok: false, problem: { column, reason } };
}

function readColumn<T>(column: string, raw: unknown, schema: z.ZodType<T>): ColumnRead<T> {
  const parsed = schema.safeParse(raw);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : failed(column, describeIssues(parsed.error));
}

function readJsonColumn<T>(column: string, raw: string, schema: z.ZodType<T>): ColumnRead<T> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    return failed(column, error instanceof Error ? error.message : String(error));
  }
  return readColumn(column, json, schema);
}

/** 保存と同じスキーマで厳密に読む。読めない列があれば問題を返す */
function readSmartFolderRow(
  r: typeof smartFolders.$inferSelect,
): { row: SmartFolder } | { unreadable: UnreadableFolderRow } {
  const condition = readJsonColumn("condition_json", r.conditionJson, conditionSchema);
  const sort = readColumn("sort", r.sort, sortIdSchema.nullable());
  const groupBy =
    r.groupByJson === null
      ? ({ ok: true, value: null } as const)
      : readJsonColumn("group_by_json", r.groupByJson, groupBySchema);
  const groupSort = readColumn("group_sort", r.groupSort, groupSortIdSchema.nullable());
  const problems = [condition, sort, groupBy, groupSort].flatMap((read) =>
    read.ok ? [] : [read.problem],
  );
  if (condition.ok && sort.ok && groupBy.ok && groupSort.ok) {
    const fields = {
      id: r.id,
      name: r.name,
      condition: condition.value,
      sort: sort.value,
      groupBy: groupBy.value,
      groupSort: groupSort.value,
    };
    const violation = smartFolderViolation(fields);
    if (violation === null) {
      return { row: { ...fields, position: r.position, createdAt: r.createdAt } };
    }
    problems.push({ column: VIOLATION_COLUMNS[violation.field], reason: violation.message });
  }
  return { unreadable: { id: r.id, name: r.name, problems } };
}
