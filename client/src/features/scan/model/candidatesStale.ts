import { ApiRequestError } from "../../../shared/api/http";

export const STALE_MESSAGE = "候補が更新されたため表示を更新しました。選び直してください。";

export function isCandidatesStale(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 409;
}
