import { eq, asc } from "drizzle-orm";
import { tagPrefixSchema, smartFolderSchema } from "@mimimilli/shared";
import type {
  ResumeBody,
  SmartFolder,
  SmartFolderCreate,
  SmartFolderUpdate,
  TagPrefix,
  TagPrefixCreate,
  TagPrefixUpdate,
  Work,
} from "@mimimilli/shared";
import { InvalidResumeError } from "../../errors.ts";
import type { Db } from "./db.ts";
import {
  appSettings,
  scanCandidateExclusions,
  smartFolders,
  tagPrefixes,
  workStates,
} from "./userSchema.ts";
import { parseJsonField, parseRecord } from "./workRowMapping.ts";

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

  saveResume(
    id: string,
    body: ResumeBody,
    trackDuration: { durationSec: number | null } | null,
  ): boolean {
    if (!trackDuration) {
      throw new InvalidResumeError("resumeのPlaylistまたはTrackが作品に属していません");
    }
    if (
      body.offsetSec < 0 ||
      (trackDuration.durationSec !== null && body.offsetSec > trackDuration.durationSec)
    ) {
      throw new InvalidResumeError("resumeのoffsetSecがトラック区間外です");
    }
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
      .orderBy(asc(tagPrefixes.id))
      .all()
      .map((r) =>
        tagPrefixSchema.parse({
          prefix: r.prefix,
          label: r.label,
          color: r.color,
          showAsAxis: r.showAsAxis,
          protected: r.protected,
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
      showAsAxis: r.showAsAxis,
      protected: r.protected,
    });
  }

  createTagPrefix(input: TagPrefixCreate): TagPrefix | null {
    const r = this.db.user
      .insert(tagPrefixes)
      .values({
        prefix: input.prefix,
        label: input.label,
        color: input.color,
        showAsAxis: input.showAsAxis,
        protected: input.protected,
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
    if (patch.showAsAxis !== undefined) set.showAsAxis = patch.showAsAxis;
    if (patch.protected !== undefined) set.protected = patch.protected;
    if (Object.keys(set).length > 0) {
      this.db.user.update(tagPrefixes).set(set).where(eq(tagPrefixes.prefix, prefix)).run();
    }
    return this.getTagPrefix(prefix);
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

  listSmartFolders(): SmartFolder[] {
    return this.db.user
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
    const r = this.db.user.select().from(smartFolders).where(eq(smartFolders.id, id)).get();
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
    this.db.user
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
      this.db.user.update(smartFolders).set(set).where(eq(smartFolders.id, id)).run();
    }
    return this.getSmartFolder(id);
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
