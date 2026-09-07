// エラーをユーザー向け表示に変換する。ローカル常駐サーバー前提のアプリなので、
// サーバー未起動・通信不能を最も頻度の高い失敗として個別に案内する。
// 通信不能・契約不一致は生のメッセージを通常表示に出さず、detailへ分離して必要時だけ展開させる。
// それ以外（ApiRequestErrorやドメイン固有のErrorが持つ、既に人間可読なmessage）は従来どおりそのまま表示する。

import { ApiResponseSchemaError } from "../api/http";

const SERVER_UNREACHABLE_MESSAGE =
  "mimimilliのサーバーに接続できませんでした。サーバーを起動し直してから再試行してください。";

const CONTRACT_MISMATCH_MESSAGE =
  "サーバーの応答を正しく読み取れませんでした。時間をおいて再試行してください。";

const NETWORK_UNREACHABLE_PATTERNS = [/failed to fetch/i, /networkerror/i, /load failed/i];

function isNetworkUnreachableMessage(message: string): boolean {
  return NETWORK_UNREACHABLE_PATTERNS.some((pattern) => pattern.test(message));
}

function isContractMismatchMessage(message: string): boolean {
  return (
    message.startsWith("APIレスポンスが契約と一致しません") || message.startsWith("API error ")
  );
}

export interface UserErrorDisplay {
  /** 通常表示に出すユーザー向けメッセージ */
  message: string;
  /** 必要時だけ展開する技術詳細。無ければnull */
  detail: string | null;
}

/**
 * エラーを分類してユーザー向け表示に変換する。
 * - 通信不能（fetch自体が失敗）: サーバー起動確認を案内する固定文言、生の内容はdetailへ
 * - 契約エラー（ApiResponseSchemaError・レスポンス形状不一致）: 固定文言、生の内容はdetailへ
 * - それ以外（ApiRequestError等、既に人間可読なmessageを持つError・文字列）: messageをそのまま表示
 * - messageが無い・分類できない値: fallbackを表示
 */
export function formatUserError(error: unknown, fallback: string): UserErrorDisplay {
  if (error instanceof ApiResponseSchemaError) {
    return { message: CONTRACT_MISMATCH_MESSAGE, detail: error.message };
  }
  if (error instanceof Error) {
    if (isNetworkUnreachableMessage(error.message)) {
      return { message: SERVER_UNREACHABLE_MESSAGE, detail: error.stack ?? error.message };
    }
    if (isContractMismatchMessage(error.message)) {
      return { message: CONTRACT_MISMATCH_MESSAGE, detail: error.message };
    }
    return { message: error.message || fallback, detail: null };
  }
  if (typeof error === "string") {
    if (isNetworkUnreachableMessage(error)) {
      return { message: SERVER_UNREACHABLE_MESSAGE, detail: error };
    }
    if (isContractMismatchMessage(error)) {
      return { message: CONTRACT_MISMATCH_MESSAGE, detail: error };
    }
    return { message: error || fallback, detail: null };
  }
  return { message: fallback, detail: null };
}
