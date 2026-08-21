import { createHash } from "node:crypto";
import type { MediaKind, PreviewCapability, WorkspaceResourceRef } from "@mimimilli/shared";

export type CatalogMediaKind = "audio" | "file";

/**
 * カバーの条件付きGETを、実体の生成・読み込みより先に判定するための情報。
 * materialize は304を返さない場合だけ呼ばれる。
 */
export interface CoverDescriptor {
  etag: string;
  /** 元ファイルの更新時刻。HTTP-dateへの秒丸めはルートでだけ行う。 */
  lastModifiedMs: number;
  materialize(): Promise<MediaLocation>;
}

/** メディア実体の所在。ルートがストリーミング（Range 対応）を担当する。
 *  - "file": 実ファイル参照（real アダプタ）。ルートが node:fs でストリーミングする
 *  - "synthetic": メモリ上で合成するコンテンツ（fixture アダプタ）。
 *    全体をメモリに保持せず、`read(start, end)` で要求された byte range 分だけ生成する */
export type MediaLocation =
  | { type: "file"; absolutePath: string; mime: string; size?: number }
  | {
      type: "synthetic";
      mime: string;
      size: number;
      read: (start: number, end: number) => Uint8Array;
    };

/** カバーrepresentationのopaqueバージョン（DTO・URLキャッシュバスター用）。 */
export function deriveCoverVersion(
  workId: string,
  width: number | undefined,
  source: { size: number; mtimeMs: number },
): string {
  const representation = width === undefined ? "original" : String(width);
  const canonical = `mimimilli-cover-v1\0${workId}\0${representation}\0${source.size}\0${source.mtimeMs}`;
  return createHash("sha256").update(canonical).digest("base64url");
}

/** カバーrepresentationのvalidator。mtimeはHTTP-dateの精度へ丸める。 */
export function createCoverValidators(
  workId: string,
  width: number | undefined,
  source: { size: number; mtimeMs: number },
): Pick<CoverDescriptor, "etag" | "lastModifiedMs"> {
  const digest = deriveCoverVersion(workId, width, source);
  return {
    etag: `W/"mimimilli-cover-v1-${digest}"`,
    lastModifiedMs: source.mtimeMs,
  };
}

export interface MediaAdapter {
  locateWorkspaceMedia(ref: WorkspaceResourceRef): Promise<WorkspaceMedia | null>;
  /** 実体が無い（fixture 等）場合は null → ルートが 404 を返す。カバーは describeCover を使う。 */
  locateMedia(
    kind: CatalogMediaKind,
    workId: string,
    relPath?: string,
  ): Promise<MediaLocation | null>;
  /** カバー専用の軽量な事前確認。音声・通常ファイルの契約は locateMedia のまま維持する。 */
  describeCover(workId: string, width?: number): Promise<CoverDescriptor | null>;
}

export interface WorkspaceMedia {
  location: MediaLocation;
  mediaKind: MediaKind;
  preview: PreviewCapability;
  /** textのプレビューのみ先頭に制限する。 */
  maxBytes?: number;
}
