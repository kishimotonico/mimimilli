import { ApiRequestError } from "../api/http";

/** ユーザー向け文言を持つ API エラーだけ message を表示し、それ以外は fallback を返す */
export function mutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (error != null) {
    console.error(fallback, error);
  }
  return fallback;
}
