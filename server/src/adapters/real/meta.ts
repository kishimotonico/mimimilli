// `.meta.json`（Source of Truth）の読み書き。
// 書き込みは tmp ファイル + rename のアトミック更新。部分更新（書き戻し）は
// 生 JSON を直接編集し、スキーマが知らないユーザー定義フィールドを保持する。
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { metaFileSchema, type MetaFile } from "@mimikago/shared";

export const META_SUFFIX = ".meta.json";

/** ファイル名がメタファイルか（フォルダー形式 ".meta.json" / 単一ファイル形式 "xxx.meta.json"） */
export function isMetaFileName(name: string): boolean {
  return name === META_SUFFIX || (name.endsWith(META_SUFFIX) && name !== META_SUFFIX);
}

export class MetaParseError extends Error {
  readonly metaPath: string;
  readonly candidateId: string | null;

  constructor(metaPath: string, detail: string, candidateId: string | null = null) {
    super(`メタファイルが不正です（${basename(metaPath)}）: ${detail}`);
    this.metaPath = metaPath;
    this.candidateId = candidateId;
  }
}

/** メタファイルを読み込み・検証する。JSON 不正・スキーマ違反は MetaParseError */
export function readMetaFile(metaPath: string): MetaFile {
  const content = readFileSync(metaPath, "utf-8");
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch (e) {
    throw new MetaParseError(metaPath, `JSON パースエラー: ${(e as Error).message}`);
  }
  const parsed = metaFileSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const candidateId =
      typeof raw === "object" && raw !== null && "id" in raw && typeof raw.id === "string" ? raw.id : null;
    throw new MetaParseError(
      metaPath,
      `${issue?.path.join(".") ?? ""} ${issue?.message ?? "不明"}`,
      candidateId
    );
  }
  return parsed.data;
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  const tmp = join(dirname(filePath), `.${basename(filePath)}.tmp`);
  writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", "utf-8");
  renameSync(tmp, filePath);
}

/** メタファイルを新規作成する（自動生成用） */
export function writeMetaFile(metaPath: string, meta: MetaFile): void {
  writeJsonAtomic(metaPath, meta);
}

/**
 * メタファイルへの部分書き戻し（UI 編集時の即時反映）。
 * 生 JSON を読み、指定フィールドだけ更新して書き戻す。スキーマ外のフィールドは保持する。
 */
export function patchMetaFile(
  metaPath: string,
  patch: { title?: string; tags?: string[]; id?: string; coverImage?: string | null; urls?: MetaFile["urls"] }
): void {
  const raw = JSON.parse(readFileSync(metaPath, "utf-8")) as Record<string, unknown>;
  if (patch.title !== undefined) raw.title = patch.title;
  if (patch.tags !== undefined) raw.tags = patch.tags;
  if (patch.id !== undefined) raw.id = patch.id;
  if (patch.coverImage !== undefined) raw.coverImage = patch.coverImage;
  if (patch.urls !== undefined) raw.urls = patch.urls;
  const parsed = metaFileSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new MetaParseError(metaPath, `${issue?.path.join(".") ?? ""} ${issue?.message ?? "不明"}`);
  }
  writeJsonAtomic(metaPath, raw);
}

/** メタファイルのパスから作品ディレクトリを返す（どちらの形式でも親ディレクトリ） */
export function workDirOf(metaPath: string): string {
  return dirname(metaPath);
}
