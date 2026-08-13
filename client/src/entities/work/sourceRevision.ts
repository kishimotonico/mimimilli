export const WORK_SOURCE_PATCH_BLOCKED_MESSAGE =
  "作品情報の同期が完了していません。画面上部の「スキャン」からライブラリをスキャンしてから編集してください。";

export function assertWorkSourceRevision(sourceRevision: string | undefined): string {
  if (!sourceRevision) {
    throw new Error(WORK_SOURCE_PATCH_BLOCKED_MESSAGE);
  }
  return sourceRevision;
}

export function canPatchWorkSource(sourceRevision: string | undefined): sourceRevision is string {
  return Boolean(sourceRevision);
}
