import {
  WORK_SOURCE_PATCH_BLOCKED_MESSAGE,
  canPatchWorkSource,
} from "../../../../entities/work/sourceRevision";

interface WorkSourcePatchBlockedNoticeProps {
  sourceRevision: string | undefined;
}

export function WorkSourcePatchBlockedNotice({
  sourceRevision,
}: WorkSourcePatchBlockedNoticeProps) {
  if (canPatchWorkSource(sourceRevision)) return null;
  return (
    <p className="mle-prv__edit-error" role="alert">
      {WORK_SOURCE_PATCH_BLOCKED_MESSAGE}
    </p>
  );
}
