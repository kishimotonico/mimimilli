import { ApiRequestError } from "../../shared/api/http";
import { sourceMutationErrorMessage } from "./sourceMutation";

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
  if (error.code === "offline") {
    return "オフライン設定（MIMIMILLI_DLSITE_OFFLINE）のため、DLsiteへ接続できません。";
  }
  return "DLsiteとの通信に失敗しました。時間をおいて再試行してください。";
}

function dlsiteRefetchRequiredMessage(): string {
  return "DLsiteの取得結果が古くなりました。もう一度取得してください。";
}

/** 適用を取り直さないと進められないエラー。ダイアログを閉じて取得からやり直す */
export function isDlsiteApplyStale(error: unknown): boolean {
  return (
    error instanceof ApiRequestError &&
    (error.code === "source_changed" || error.code === "dlsite_refetch_required")
  );
}

export function dlsiteApplyErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.code === "dlsite_refetch_required") {
    return dlsiteRefetchRequiredMessage();
  }
  if (error instanceof ApiRequestError && error.code === "source_changed") {
    return dlsiteSourceChangedMessage();
  }
  return sourceMutationErrorMessage(error, "DLsite情報を適用できませんでした");
}
