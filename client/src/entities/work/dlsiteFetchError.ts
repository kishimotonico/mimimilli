import { ApiRequestError } from "../../shared/api/http";

export function dlsiteFetchErrorMessage(error: unknown): string {
  if (!(error instanceof ApiRequestError)) return "DLsite情報の取得に失敗しました";
  if (error.code === "not_found") return "作品が見つかりません。コードが違うかもしれません。";
  if (error.code === "parse_error") return "DLsiteのページ構造が変わった可能性があります。";
  return "DLsiteとの通信に失敗しました。時間をおいて再試行してください。";
}
