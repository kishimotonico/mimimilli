// 再生エラーの表示用フォーマット。BarContent / PopupContent 共通。

import type { AudioEngineError } from "../model/audioEngine";

interface FormattedPlaybackError {
  label: string;
  details: string;
}

const ERROR_LABELS: Record<string, string> = {
  NotSupportedError: "この音声形式またはURLは再生できません",
  NotAllowedError: "ブラウザにより再生がブロックされました",
  AbortError: "音声の読み込みが中断されました",
};

export function formatPlaybackError(error: AudioEngineError): FormattedPlaybackError {
  const details = [
    error.name,
    error.code !== undefined ? `code ${error.code}` : null,
  ].filter(Boolean).join(" / ");

  const rawDetails = details ? `${error.message} (${details})` : error.message;
  const knownLabel = error.name ? ERROR_LABELS[error.name] : undefined;

  return {
    label: knownLabel ?? rawDetails,
    details: rawDetails,
  };
}
