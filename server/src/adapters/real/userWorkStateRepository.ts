import { and, asc, eq, gte, isNotNull, sql } from "drizzle-orm";
import type { z } from "zod";
import {
  conditionTreeSchema,
  groupBySchema,
  groupSortIdSchema,
  sortIdSchema,
  tagPrefixSchema,
} from "@mimimilli/shared";
import type {
  Condition,
  ResumeBody,
  SmartFolderWrite,
  GroupSortId,
  SortId,
  TagPrefix,
  TagPrefixCreate,
  TagPrefixUpdate,
  Work,
} from "@mimimilli/shared";
import type { SmartFolderInsert, SmartFolderRow } from "../../adapter/classification.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import type { Db } from "./db.ts";
import {
  appSettings,
  scanCandidateExclusions,
  smartFolders,
  tagPrefixes,
  workStates,
} from "./userSchema.ts";

const smartFolderLogger = getCategoryLogger("db");

export class UserWorkStateRepository {
  private readonly db: Db;
  /** 警告済みの壊れた行（id → 問題の署名）。一覧を取るたびに同じ警告を重ねない。直った行は忘れる */
  private readonly reportedBrokenFolders = new Map<string, string>();

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

  listSmartFolders(): SmartFolderRow[] {
    return this.db.user
      .select()
      .from(smartFolders)
      .orderBy(asc(smartFolders.position), asc(smartFolders.createdAt), asc(smartFolders.id))
      .all()
      .map((row) => toSmartFolderRow(row, this.reportedBrokenFolders));
  }

  getSmartFolder(id: string): SmartFolderRow | null {
    const r = this.db.user.select().from(smartFolders).where(eq(smartFolders.id, id)).get();
    return r ? toSmartFolderRow(r, this.reportedBrokenFolders) : null;
  }

  /** 既にある ID は飛ばして末尾へ追加し、flagKey を立てる */
  seedSmartFolders(folders: SmartFolderInsert[], flagKey: string): void {
    this.db.userTransaction(() => {
      for (const folder of folders) this.appendSmartFolder(folder);
      this.setUserSetting(flagKey, "1");
    });
  }

  /** 末尾へ追加する。ID が既にあれば null */
  appendSmartFolder(folder: SmartFolderInsert): SmartFolderRow | null {
    return this.db.userTransaction(() => {
      if (this.getSmartFolder(folder.id)) return null;
      const position = this.db.user
        .select({ position: smartFolders.position })
        .from(smartFolders)
        .all()
        .reduce((max, row) => Math.max(max, row.position + 1), 0);
      return this.insertSmartFolderRow({ ...folder, position });
    });
  }

  /** 同じ ID・位置・作成日時で戻す。位置が埋まっていれば、その位置以降を1つずつ後ろへ送る。ID が既にあれば null */
  restoreSmartFolder(folder: SmartFolderRow & { condition: Condition }): SmartFolderRow | null {
    return this.db.userTransaction(() => {
      if (this.getSmartFolder(folder.id)) return null;
      const occupied = this.db.user
        .select({ id: smartFolders.id })
        .from(smartFolders)
        .where(eq(smartFolders.position, folder.position))
        .get();
      if (occupied) {
        this.db.user
          .update(smartFolders)
          .set({ position: sql`${smartFolders.position} + 1` })
          .where(gte(smartFolders.position, folder.position))
          .run();
      }
      return this.insertSmartFolderRow(folder);
    });
  }

  private insertSmartFolderRow(folder: SmartFolderRow & { condition: Condition }): SmartFolderRow {
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

  updateSmartFolder(id: string, input: SmartFolderWrite): SmartFolderRow | null {
    const r = this.db.user
      .update(smartFolders)
      .set({
        name: input.name,
        conditionJson: JSON.stringify(input.condition),
        sort: input.sort,
        groupByJson: input.groupBy === null ? null : JSON.stringify(input.groupBy),
        groupSort: input.groupSort,
      })
      .where(eq(smartFolders.id, id))
      .returning()
      .get();
    return r ? toSmartFolderRow(r, this.reportedBrokenFolders) : null;
  }

  updateSmartFolderSort(id: string, sort: SortId | null): SmartFolderRow | null {
    const r = this.db.user
      .update(smartFolders)
      .set({ sort })
      .where(eq(smartFolders.id, id))
      .returning()
      .get();
    return r ? toSmartFolderRow(r, this.reportedBrokenFolders) : null;
  }

  /** グループ分けのある行だけを更新する。グループ分けを外す更新と交差しても、値の並びだけが残る行を作らない */
  updateSmartFolderGroupSort(id: string, groupSort: GroupSortId): SmartFolderRow | null {
    const r = this.db.user
      .update(smartFolders)
      .set({ groupSort })
      .where(and(eq(smartFolders.id, id), isNotNull(smartFolders.groupByJson)))
      .returning()
      .get();
    return r ? toSmartFolderRow(r, this.reportedBrokenFolders) : null;
  }

  /** 全件の順序を置き換える。渡された集合が今の集合と一致しなければ null */
  reorderSmartFolders(ids: string[]): SmartFolderRow[] | null {
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
    this.reportedBrokenFolders.delete(id);
    return (
      this.db.user
        .delete(smartFolders)
        .where(eq(smartFolders.id, id))
        .returning({ id: smartFolders.id })
        .get() !== undefined
    );
  }
}

type ColumnProblem = { column: string; reason: unknown };
type ColumnRead<T> = { ok: true; value: T } | { ok: false; problem: ColumnProblem };

function failed(column: string, reason: unknown): { ok: false; problem: ColumnProblem } {
  return { ok: false, problem: { column, reason } };
}

function readJsonColumn<T>(column: string, raw: string, schema: z.ZodType<T>): ColumnRead<T> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    return failed(column, error instanceof Error ? error.message : String(error));
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? { ok: true, value: parsed.data } : failed(column, parsed.error.issues);
}

/** condition・sort・groupBy・groupSort のどれか1つでも読めない、または groupBy と groupSort の組が合わなければ、4つとも null の壊れた行にする。壊れた行は同じ問題につき1回だけ警告する */
function toSmartFolderRow(
  r: typeof smartFolders.$inferSelect,
  reportedBrokenFolders: Map<string, string>,
): SmartFolderRow {
  const base = { id: r.id, name: r.name, position: r.position, createdAt: r.createdAt };
  const condition = readJsonColumn("condition_json", r.conditionJson, conditionTreeSchema);
  const sort = sortIdSchema.nullable().safeParse(r.sort);
  const groupBy =
    r.groupByJson === null
      ? ({ ok: true, value: null } as const)
      : readJsonColumn("group_by_json", r.groupByJson, groupBySchema);
  const groupSort = groupSortIdSchema.nullable().safeParse(r.groupSort);
  const problems: ColumnProblem[] = [];
  if (!condition.ok) problems.push(condition.problem);
  if (!sort.success) problems.push({ column: "sort", reason: sort.error.issues });
  if (!groupBy.ok) problems.push(groupBy.problem);
  if (!groupSort.success) problems.push({ column: "group_sort", reason: groupSort.error.issues });
  const mismatched =
    groupBy.ok && groupSort.success && (groupBy.value === null) !== (groupSort.data === null);
  if (mismatched) {
    problems.push({ column: "group_sort", reason: "group_by_json と group_sort の組が合いません" });
  }
  if (!condition.ok || !sort.success || !groupBy.ok || !groupSort.success || mismatched) {
    const signature = JSON.stringify(problems);
    if (reportedBrokenFolders.get(r.id) !== signature) {
      reportedBrokenFolders.set(r.id, signature);
      smartFolderLogger.warn("壊れたスマートフォルダーの行を読み込めません", {
        smartFolderId: r.id,
        problems,
      });
    }
    return { ...base, condition: null, sort: null, groupBy: null, groupSort: null };
  }
  reportedBrokenFolders.delete(r.id);
  return {
    ...base,
    condition: condition.value,
    sort: sort.data,
    groupBy: groupBy.value,
    groupSort: groupSort.data,
  };
}
