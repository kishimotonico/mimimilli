import { ApiRequestError } from "../../shared/api/http";

/** GET /source および正本コマンドが返せないときの表示。サーバーの message をそのまま出す。 */
export function sourceEditErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
