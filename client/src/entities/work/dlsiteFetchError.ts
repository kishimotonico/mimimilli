import { ApiRequestError } from "../../shared/api/http";

function dlsiteSourceChangedMessage(): string {
  return "作品データが変更されました。取得結果を確認し直してから適用してください。";
}

export function dlsiteFetchErrorMessage(error: unknown): string {
  if (!(error instanceof ApiRequestError)) return "DLsite情報の取得に失敗しました";
  if (error.code === "source_changed") {
    return dlsiteSourceChangedMessage();
  }
  if (error.code === "not_found") return "作品が見つかりません。コードが違うかもしれません。";
  if (error.code === "parse_error") return "DLsiteのページ構造が変わった可能性があります。";
  return "DLsiteとの通信に失敗しました。時間をおいて再試行してください。";
}

export function dlsiteApplyErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.code === "source_changed") {
    return dlsiteSourceChangedMessage();
  }
  if (error instanceof Error) return error.message;
  return "DLsite情報を適用できませんでした";
}
