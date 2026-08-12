import type { MetaFile, Work } from "@mimimilli/shared";
import type { MetaParseError } from "./meta.ts";
import type { CoverColumns, ScanWorkState } from "./workRowMapping.ts";
import type { WorkRevisions } from "./fingerprint.ts";

export interface PreparedMeta {
  kind: "ok";
  metaPath: string;
  meta: MetaFile;
  revisions: WorkRevisions;
  cachedRevisions: WorkRevisions | undefined;
  /** DB上の前回スキャン時の status。error は fingerprint スキップの対象外。 */
  cachedStatus: Work["status"] | undefined;
  /** カバー欠損判定（DBの寸法充足状況）。false ならfingerprint一致でも再処理が必要。 */
  coverSatisfied: boolean;
}

interface PreparedError {
  kind: "error";
  metaPath: string;
  error: MetaParseError;
}

interface PreparedSkip {
  kind: "skip";
  metaPath: string;
  id: string;
}

export interface PreparedIdentityConflict {
  kind: "identity_conflict";
  metaPath: string;
  workId: string;
}

export type PreparedEntry = PreparedMeta | PreparedError | PreparedSkip | PreparedIdentityConflict;

/** fingerprint 一致かつカバー充足のとき増分スキャンでスキップできるか。 */
export function canSkipIncremental(
  full: boolean,
  cachedFingerprint: WorkRevisions | undefined,
  revisions: WorkRevisions,
  coverSatisfied: boolean,
  cachedStatus: Work["status"] | undefined,
): boolean {
  if (full) return false;
  if (cachedStatus === "error") return false;
  return (
    cachedFingerprint?.sourceRevision === revisions.sourceRevision &&
    cachedFingerprint.projectionRevision === revisions.projectionRevision &&
    cachedFingerprint.mediaRevision === revisions.mediaRevision &&
    coverSatisfied
  );
}

export function isCoverSatisfied(
  coverImage: string | null,
  cachedCover: CoverColumns | undefined,
): boolean {
  return coverImage === null ? cachedCover?.image == null : cachedCover?.dimensions != null;
}

export function coverSatisfiedForState(
  meta: Pick<MetaFile, "coverImage">,
  state: ScanWorkState | undefined,
): boolean {
  return isCoverSatisfied(meta.coverImage, state?.cover);
}
