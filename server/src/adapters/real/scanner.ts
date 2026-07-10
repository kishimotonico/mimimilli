// ライブラリスキャン。
//
// フロー（要件 v4 §8 / HANDOFF.md）:
//   1. 全作品を「行方不明」にマーク
//   2. ルート以下を走査し、メタファイル（.meta.json / *.meta.json）を登録
//      - ID で突合し、移動・リネームに追従（DB の既存情報を保持）
//      - 同一 UUID の重複は後に検出された方を再採番してメタファイルへ書き戻す
//      - 参照先音声の欠損は status "error" + errorMessage
//      - 再生時間は music-metadata でプローブし SQLite にキャッシュ
//   3. メタファイルのない音声フォルダーへ .meta.json を自動生成（下書き）
//   4. missing のまま残った作品 = 物理パス消失
//
// Rust 版からの意図的な変更:
//   - 作品ルート判定: Rust 版は「ルート直下の子」まで一律に昇格していたが、
//     「親に画像がある（カバー同梱の典型構成）/ 親が単一サブフォルダーのラッパー」の
//     場合のみ昇格する保守的なヒューリスティックへ変更（ジャンル分けフォルダーを
//     1作品に誤認しない）。自動生成はあくまで下書きで、ユーザー修正を前提とする
//   - シンボリックリンクのディレクトリは辿らない（循環防止）
import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import type {
  MetaFile,
  Playlist,
  ScanProgressEvent,
  ScanResult,
  Track,
  Work,
} from "@mimimilli/shared";
import type { Db } from "./db.ts";
import {
  isMetaFileName,
  MetaParseError,
  patchMetaFile,
  readMetaFile,
  writeMetaFile,
} from "./meta.ts";
import { isPathWithin, toPortableRelativePath } from "./paths.ts";
import { probeDurationSec } from "./probe.ts";
import type { WorkRepo } from "./workRepo.ts";

const AUDIO_EXTENSIONS = new Set(["mp3", "m4a", "aac", "wav", "ogg", "flac", "webm", "opus"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "bmp", "webp"]);

function extOf(name: string): string {
  return extname(name).slice(1).toLowerCase();
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, "ja", { numeric: true, sensitivity: "base" });
}

interface WalkResult {
  metaPaths: string[];
  /** メタファイル（いずれかの形式）が直接存在するディレクトリ */
  metaDirs: Set<string>;
  /** 音声ファイルが直接存在するディレクトリ */
  audioDirs: Set<string>;
}

function walk(root: string): WalkResult {
  const result: WalkResult = { metaPaths: [], metaDirs: new Set(), audioDirs: new Set() };
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      console.warn(`ディレクトリを読めません: ${dir}: ${(e as Error).message}`);
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        if (isMetaFileName(entry.name)) {
          result.metaPaths.push(full);
          result.metaDirs.add(dir);
        } else if (AUDIO_EXTENSIONS.has(extOf(entry.name))) {
          result.audioDirs.add(dir);
        }
      }
      // シンボリックリンクは辿らない（循環防止）
    }
  }
  result.metaPaths.sort(naturalCompare);
  return result;
}

/** dir またはルートまでの祖先にメタファイルがあるか */
function isCoveredByMeta(dir: string, root: string, metaDirs: Set<string>): boolean {
  let cur = dir;
  while (isPathWithin(root, cur)) {
    if (metaDirs.has(cur)) return true;
    if (cur === root) break;
    cur = dirname(cur);
  }
  return false;
}

/** 音声ディレクトリから作品ルートを推定する（保守的に昇格） */
function findWorkRoot(audioDir: string, root: string, metaDirs: Set<string>): string {
  let cur = audioDir;
  while (true) {
    const parent = dirname(cur);
    if (cur === root || parent === cur || !isPathWithin(root, parent) || parent === root) break;

    // 親の下に既存メタ作品があるなら昇格しない（登録済み作品を飲み込まない）
    let swallowsMeta = false;
    for (const metaDir of metaDirs) {
      if (isPathWithin(parent, metaDir)) {
        swallowsMeta = true;
        break;
      }
    }
    if (swallowsMeta) break;

    let entries;
    try {
      entries = readdirSync(parent, { withFileTypes: true });
    } catch {
      break;
    }
    const subdirCount = entries.filter((e) => e.isDirectory()).length;
    const hasImage = entries.some((e) => e.isFile() && IMAGE_EXTENSIONS.has(extOf(e.name)));

    // カバー画像同梱の典型構成（RJxxxx/cover.jpg + mp3/…）か、単一サブフォルダーのラッパーのみ昇格
    if (hasImage || subdirCount === 1) {
      cur = parent;
    } else {
      break;
    }
  }
  return cur;
}

function findCoverImage(dir: string): string | null {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const images = entries
    .filter((e) => e.isFile() && IMAGE_EXTENSIONS.has(extOf(e.name)))
    .map((e) => e.name)
    .sort(naturalCompare);
  const preferred = images.find((n) => {
    const lower = n.toLowerCase();
    return lower.includes("cover") || lower.includes("jacket");
  });
  return preferred ?? images[0] ?? null;
}

function collectAudioRecursive(dir: string): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && AUDIO_EXTENSIONS.has(extOf(e.name))) out.push(full);
    }
  }
  return out;
}

/** 自動生成のトラック構築: 直下の音声を優先、無ければ最多の直下サブフォルダー（要件 v4 §3.5） */
function buildDefaultTracks(workDir: string): Track[] {
  const entries = readdirSync(workDir, { withFileTypes: true });
  const directAudio = entries
    .filter((e) => e.isFile() && AUDIO_EXTENSIONS.has(extOf(e.name)))
    .map((e) => join(workDir, e.name));

  let files: string[];
  if (directAudio.length > 0) {
    files = directAudio;
  } else {
    const bySubdir = entries
      .filter((e) => e.isDirectory())
      .map((e) => collectAudioRecursive(join(workDir, e.name)));
    bySubdir.sort((a, b) => b.length - a.length);
    files = bySubdir[0] ?? [];
  }

  files.sort(naturalCompare);
  return files.map((f) => ({
    title: basename(f, extname(f)),
    file: toPortableRelativePath(workDir, f),
  }));
}

function defaultPlaylistOf(meta: MetaFile): Playlist | null {
  if (meta.playlists.length === 0) return null;
  if (meta.defaultPlaylist) {
    return meta.playlists.find((p) => p.name === meta.defaultPlaylist)!;
  }
  return meta.playlists[0]!;
}

export class Scanner {
  private readonly db: Db;
  private readonly repo: WorkRepo;

  constructor(db: Db, repo: WorkRepo) {
    this.db = db;
    this.repo = repo;
  }

  async scan(root: string, onProgress?: (event: ScanProgressEvent) => void): Promise<ScanResult> {
    const emit = onProgress ?? ((): void => {});
    const result: ScanResult = {
      registered: 0,
      newlyGenerated: 0,
      errors: 0,
      missing: 0,
      newWorkIds: [],
    };

    // walking フェーズ: ディレクトリ走査自体は件数が事前に分からないため不定（total=0）で通知する
    emit({ type: "progress", phase: "walking", processed: 0, total: 0 });
    const tree = walk(root);
    const seenIds = new Set<string>();

    // 1. 既存メタファイルの登録
    emit({ type: "progress", phase: "registering", processed: 0, total: tree.metaPaths.length });
    for (let i = 0; i < tree.metaPaths.length; i++) {
      const metaPath = tree.metaPaths[i]!;
      try {
        await this.registerMetaFile(metaPath, seenIds);
        result.registered += 1;
      } catch (e) {
        if (e instanceof MetaParseError) {
          console.warn(e.message);
          const workDir = dirname(metaPath);
          const existingById =
            e.candidateId && !seenIds.has(e.candidateId) ? this.repo.getWork(e.candidateId) : null;
          const existing = existingById ?? this.repo.getWorkByPhysicalPath(workDir);
          if (existing) {
            this.repo.markWorkError(existing.id, workDir, e.message);
            seenIds.add(existing.id);
          }
          result.errors += 1;
        } else {
          throw e;
        }
      }
      emit({
        type: "progress",
        phase: "registering",
        processed: i + 1,
        total: tree.metaPaths.length,
      });
    }

    // 2. メタファイルのない音声フォルダーへ自動生成（下書き）
    const workRoots = new Set<string>();
    for (const audioDir of tree.audioDirs) {
      if (isCoveredByMeta(audioDir, root, tree.metaDirs)) continue;
      // ルート直下に直接置かれた音声（単一ファイル形式）は自動生成の対象外（要件 v4 §3.5）
      if (audioDir === root) continue;
      workRoots.add(findWorkRoot(audioDir, root, tree.metaDirs));
    }
    // 祖先が同時に検出された場合は祖先側に統合する
    const roots = [...workRoots]
      .filter((dir) => ![...workRoots].some((other) => other !== dir && isPathWithin(other, dir)))
      .sort(naturalCompare);

    emit({ type: "progress", phase: "generating", processed: 0, total: roots.length });
    for (let i = 0; i < roots.length; i++) {
      const workDir = roots[i]!;
      try {
        const id = this.generateMetaForFolder(workDir);
        await this.registerMetaFile(join(workDir, ".meta.json"), seenIds);
        result.newlyGenerated += 1;
        result.newWorkIds.push(id);
      } catch (e) {
        console.warn(`メタファイルの自動生成に失敗: ${workDir}: ${(e as Error).message}`);
        result.errors += 1;
      }
      emit({ type: "progress", phase: "generating", processed: i + 1, total: roots.length });
    }

    emit({ type: "progress", phase: "finalizing", processed: 0, total: 1 });
    this.repo.markMissingExcept([...seenIds]);
    result.missing = this.repo.countByStatus("missing");
    emit({ type: "progress", phase: "finalizing", processed: 1, total: 1 });
    return result;
  }

  /** メタファイル1件を DB に登録する（ID 突合・重複再採番・欠損検出・duration プローブ込み） */
  private async registerMetaFile(metaPath: string, seenIds: Set<string>): Promise<string> {
    const meta = readMetaFile(metaPath);
    const workDir = dirname(metaPath);

    // 同一 UUID 重複 → 後に検出された方を再採番（要件 v4 §3.1）
    let id = meta.id;
    if (seenIds.has(id)) {
      id = crypto.randomUUID();
      patchMetaFile(metaPath, { id });
      console.warn(`UUID 重複を検出したため再採番しました: ${metaPath}（${meta.id} → ${id}）`);
    }
    seenIds.add(id);

    // 参照先ファイルの欠損チェック
    const playlist = defaultPlaylistOf(meta);
    const missingFiles = (playlist?.tracks ?? []).filter((t) => !existsSync(join(workDir, t.file)));
    const errorMessage =
      missingFiles.length > 0
        ? `参照先ファイルが見つかりません: ${missingFiles.map((t) => t.file).join(", ")}`
        : null;

    // 再生時間（デフォルトプレイリストの合計）
    let totalDurationSec = 0;
    for (const track of playlist?.tracks ?? []) {
      if (track.start !== undefined && track.end !== undefined) {
        totalDurationSec += Math.max(0, track.end - track.start);
      } else {
        totalDurationSec += await probeDurationSec(this.db, join(workDir, track.file));
      }
    }

    // 既存作品の DB 固有情報を保持（移動追従時も含む）
    const existing = this.repo.getWork(id);
    const work: Work = {
      id,
      title: meta.title,
      coverImage: meta.coverImage,
      defaultPlaylist: meta.defaultPlaylist,
      createdAt: meta.createdAt ?? null,
      status: errorMessage ? "error" : "ok",
      physicalPath: workDir,
      totalDurationSec,
      addedAt: existing?.addedAt ?? new Date().toISOString(),
      errorMessage,
      urls: meta.urls,
      tags: meta.tags,
      playlists: meta.playlists,
      bookmarked: existing?.bookmarked ?? false,
      lastPlayedAt: existing?.lastPlayedAt ?? null,
      resumePosition: existing?.resumePosition ?? 0,
      resumeTrackIndex: existing?.resumeTrackIndex ?? 0,
    };
    this.repo.upsertWork(work);
    return id;
  }

  /** 音声フォルダーへメタファイルを自動生成する（要件 v4 §3.5。あくまで下書き） */
  private generateMetaForFolder(workDir: string): string {
    const id = crypto.randomUUID();
    const tracks = buildDefaultTracks(workDir);
    const meta: MetaFile = {
      id,
      title: basename(workDir),
      urls: [],
      tags: [],
      coverImage: findCoverImage(workDir),
      playlists: tracks.length > 0 ? [{ name: "default", tracks }] : [],
      defaultPlaylist: tracks.length > 0 ? "default" : null,
      createdAt: new Date().toISOString(),
    };
    writeMetaFile(join(workDir, ".meta.json"), meta);
    return id;
  }
}
