import { ApiRequestError } from "../../../../shared/api/http";

interface WorkSourcePatchBlockedNoticeProps {
  message: string | null;
}

export function WorkSourcePatchBlockedNotice({ message }: WorkSourcePatchBlockedNoticeProps) {
  if (!message) return null;
  return (
    <p className="mle-prv__edit-error" role="alert">
      {message}
    </p>
  );
}

export function sourceCommandBlockMessage(error: unknown): string | null {
  if (!(error instanceof ApiRequestError)) return null;
  if (error.code !== "parse_error" && error.code !== "conflict") return null;
  return error.message;
}
