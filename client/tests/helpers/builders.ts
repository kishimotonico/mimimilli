import {
  workspacePath,
  axisFacetItemSchema,
  dlsiteApplyMissingPreviewSchema,
  dlsiteBulkResultSchema,
  dlsiteBulkSnapshotSchema,
  fsEntrySchema,
  fsListingSchema,
  dlsiteBulkApplyMissingResultSchema,
  dlsiteNotificationSummarySchema,
  scanCandidateSchema,
  scanCandidatesRegisterResponseSchema,
  resolvedPlaylistSchema,
  workListItemSchema,
  worksPageSchema,
  dlsitePreviewSchema,
  emptyDlsiteState,
  scanDiagnosticsSchema,
  scanJobEventSchema,
  scanJobSnapshotSchema,
  scanLastResultResponseSchema,
  scanResultSchema,
  settingsSchema,
  smartFolderSchema,
  tagPrefixSchema,
  toDlsiteLinkageStatus,
  workEditSnapshotSchema,
  workSchema,
  workSourceMutationResultSchema,
  type AxisFacetItem,
  type DlsiteApplyMissingPreview,
  type DlsiteBulkResult,
  type DlsiteBulkSnapshot,
  type FsEntry,
  type FsListing,
  type DlsiteBulkApplyMissingResult,
  type DlsiteNotificationSummary,
  type DlsitePreview,
  type ScanDiagnostics,
  type ScanLastResultResponse,
  type ScanResult,
  type Settings,
  type SmartFolder,
  type TagPrefix,
  type ResolvedPlaylist,
  type ScanCandidate,
  type ScanJobEvent,
  type ScanJobSnapshot,
  type ScanCandidatesRegisterResponse,
  type Work,
  type WorkListItem,
  type WorksPage,
  type WorkEditSnapshot,
  type WorkSourceMutationResult,
} from "@mimimilli/shared";

// APIレスポンスのテストデータは必ず shared のスキーマを通して作る。
// 契約に合わない値を置くとテスト側で即座に失敗する。

export function buildWork(overrides: Partial<Work> = {}): Work {
  return workSchema.parse({
    id: "work-1",
    title: "作品",
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: "/lib/work-1",
    totalDurationSec: 0,
    addedAt: "2026-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
    defaultPlaylistId: null,
    createdAt: null,
    playlists: [],
    resume: null,
    ...overrides,
  });
}

export function buildWorkEditSnapshot(overrides: Partial<WorkEditSnapshot> = {}): WorkEditSnapshot {
  return workEditSnapshotSchema.parse({
    sourceRevision: "rev-1",
    id: "work-1",
    physicalPath: "/lib/work-1",
    title: "作品",
    tags: [],
    urls: [],
    coverImage: null,
    dlsite: { rjCode: null, status: "none", appliedTags: [] },
    ...overrides,
  });
}

/** 閲覧用 Work と同じ内容の編集 snapshot */
export function buildWorkEditSnapshotOf(work: Work, sourceRevision = "rev-1"): WorkEditSnapshot {
  return buildWorkEditSnapshot({
    sourceRevision,
    id: work.id,
    physicalPath: work.physicalPath,
    title: work.title,
    tags: work.tags,
    urls: work.urls,
    coverImage: work.coverImage,
    dlsite: {
      rjCode: work.dlsite.rjCode,
      status: toDlsiteLinkageStatus(work.dlsite.status),
      appliedTags: work.dlsite.appliedTags,
    },
  });
}

export function buildWorkSourceMutationResult(
  snapshot: WorkEditSnapshot = buildWorkEditSnapshot(),
  projection: WorkSourceMutationResult["projection"] = { status: "published" },
): WorkSourceMutationResult {
  return workSourceMutationResultSchema.parse({ snapshot, projection });
}

export function buildDlsitePreview(
  info: Partial<DlsitePreview["info"]> = {},
  sourceRevision = "rev-1",
): DlsitePreview {
  return dlsitePreviewSchema.parse({
    info: {
      rjCode: "RJ501001",
      title: "取得タイトル",
      circle: "夜想曲",
      cvs: [],
      genreTags: [],
      ageRating: null,
      coverUrl: "https://example.test/cover.jpg",
      url: "https://www.dlsite.com/maniax/work/=/product_id/RJ501001.html",
      ...info,
    },
    sourceRevision,
  });
}

export function buildSettings(overrides: Partial<Settings> = {}): Settings {
  return settingsSchema.parse({
    rootFolder: "/library",
    lastScanTime: null,
    rootReconfiguration: { status: "idle", completedAt: null },
    ...overrides,
  });
}

export function buildSmartFolder(overrides: Partial<SmartFolder> = {}): SmartFolder {
  return smartFolderSchema.parse({
    id: "sf-1",
    name: "スマートフォルダー",
    rules: [],
    sort: "added-desc",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
}

export function buildDlsiteNotificationSummary(
  overrides: Partial<DlsiteNotificationSummary> = {},
): DlsiteNotificationSummary {
  return dlsiteNotificationSummarySchema.parse({
    rjCodeMissingCount: 0,
    fetchFailedCount: 0,
    parseErrorCount: 0,
    parseErrorAlert: false,
    unlinkedCount: 0,
    ...overrides,
  });
}

export function buildScanDiagnostics(overrides: Partial<ScanDiagnostics> = {}): ScanDiagnostics {
  return scanDiagnosticsSchema.parse({ identityConflicts: [], invalidMetaFiles: [], ...overrides });
}

export function buildScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return scanResultSchema.parse({
    registered: 0,
    insertedWorkIds: [],
    updatedWorkIds: [],
    errors: 0,
    missing: 0,
    skipped: 0,
    coverErrors: 0,
    ...overrides,
  });
}

export function buildScanLastResult(
  overrides: Partial<ScanLastResultResponse> = {},
): ScanLastResultResponse {
  return scanLastResultResponseSchema.parse({
    result: buildScanResult(),
    finishedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
}

export function buildTagPrefix(overrides: Partial<TagPrefix> = {}): TagPrefix {
  return tagPrefixSchema.parse({
    prefix: "cv",
    label: "CV",
    color: null,
    showAsAxis: true,
    protected: false,
    order: 0,
    ...overrides,
  });
}

export function buildWorkListItem(
  overrides: Partial<WorkListItem> & { id: string } = { id: "work-1" },
): WorkListItem {
  return workListItemSchema.parse({
    title: "作品",
    cover: null,
    status: "ok",
    totalDurationSec: null,
    trackCount: 1,
    bookmarked: false,
    lastPlayedAt: null,
    circleName: null,
    relativePath: workspacePath(overrides.id),
    dlsite: { rjCode: null, status: "none" },
    ...overrides,
  });
}

export function buildWorksPage(
  items: WorkListItem[] = [],
  overrides: Partial<WorksPage> = {},
): WorksPage {
  return worksPageSchema.parse({
    items,
    total: items.length,
    stats: { trackCount: 0, durationSec: 0 },
    ...overrides,
  });
}

export function buildScanCandidate(
  overrides: Partial<ScanCandidate> & { path: string },
): ScanCandidate {
  return scanCandidateSchema.parse({
    inferredTitle: "候補",
    audioFileCount: 1,
    audioBreakdown: [{ extension: "mp3", count: 1 }],
    rjCode: null,
    ...overrides,
    path: workspacePath(overrides.path),
  });
}

export function buildScanCandidatesRegisterResponse(
  overrides: Partial<ScanCandidatesRegisterResponse> = {},
): ScanCandidatesRegisterResponse {
  return scanCandidatesRegisterResponseSchema.parse({
    registered: [],
    failures: [],
    ...overrides,
  });
}

/** 連番から決まる UUID v4。スキーマの uuid 検証を通る */
export function testUuid(n: number): string {
  return `${n.toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`;
}

export function buildResolvedPlaylist(
  n: number,
  trackFiles: string[],
  overrides: Partial<ResolvedPlaylist> = {},
): ResolvedPlaylist {
  return resolvedPlaylistSchema.parse({
    id: testUuid(n),
    name: `playlist-${n}`,
    tracks: trackFiles.map((file, i) => ({
      id: testUuid(n * 1000 + i + 1),
      title: file,
      file: `${file}.wav`,
      durationSec: 10,
      durationKind: "resolved",
    })),
    ...overrides,
  });
}

export function buildDlsiteApplyMissingPreview(
  items: DlsiteApplyMissingPreview["items"] = [],
): DlsiteApplyMissingPreview {
  return dlsiteApplyMissingPreviewSchema.parse({ items });
}

export function buildDlsiteBulkApplyMissingResult(
  overrides: Partial<DlsiteBulkApplyMissingResult> = {},
): DlsiteBulkApplyMissingResult {
  return dlsiteBulkApplyMissingResultSchema.parse({
    applied: 0,
    pending: 0,
    skipped: 0,
    failed: 0,
    ...overrides,
  });
}

export function buildFsEntry(overrides: Partial<FsEntry> & { path: string }): FsEntry {
  return fsEntrySchema.parse({
    name: overrides.path.split("/").at(-1),
    isDir: false,
    size: 100,
    fileType: "audio",
    childCount: 0,
    workId: null,
    workRelPath: null,
    mediaKind: "audio",
    preview: { kind: "available" },
    ...overrides,
  });
}

export function buildFsListing(
  entries: FsEntry[] = [],
  overrides: Partial<FsListing> = {},
): FsListing {
  return fsListingSchema.parse({ path: null, parent: null, workId: null, entries, ...overrides });
}

export function buildAxisFacetItem(overrides: Partial<AxisFacetItem> = {}): AxisFacetItem {
  return axisFacetItemSchema.parse({
    value: "値",
    count: 1,
    durationSec: 0,
    covers: [],
    ...overrides,
  });
}

export function buildScanJobSnapshot(overrides: Partial<ScanJobSnapshot> = {}): ScanJobSnapshot {
  return scanJobSnapshotSchema.parse({
    id: "job-1",
    status: "running",
    createdAt: "2026-01-01T00:00:00.000Z",
    startedAt: "2026-01-01T00:00:00.001Z",
    finishedAt: null,
    progress: null,
    result: null,
    error: null,
    ...overrides,
  });
}

export function buildScanJobEvent(event: ScanJobEvent): ScanJobEvent {
  return scanJobEventSchema.parse(event);
}

export function buildDlsiteBulkResult(overrides: Partial<DlsiteBulkResult> = {}): DlsiteBulkResult {
  return dlsiteBulkResultSchema.parse({
    fetched: 0,
    failed: 0,
    parseErrors: 0,
    skipped: 0,
    ...overrides,
  });
}

export function buildDlsiteBulkSnapshot(
  overrides: Partial<DlsiteBulkSnapshot> = {},
): DlsiteBulkSnapshot {
  return dlsiteBulkSnapshotSchema.parse({ current: null, lastTerminal: null, ...overrides });
}
