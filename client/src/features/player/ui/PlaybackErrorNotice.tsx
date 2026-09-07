// 再生エラー表示。Bar / Popup / 再生中タブで共通利用する。

import type { AudioEngineError } from "../model/audioEngine";
import { formatPlaybackError } from "./formatPlaybackError";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import { cn } from "../../../shared/lib/cn";

interface PlaybackErrorNoticeProps {
  error: AudioEngineError | null;
  className?: string;
  iconSize?: number;
  /** 再試行（同じ音声の読み込み直し）。省略時はボタンを出さない */
  onRetry?: () => void;
  /** 通知を閉じる。省略時はボタンを出さない */
  onDismiss?: () => void;
}

export default function PlaybackErrorNotice({
  error,
  className,
  iconSize = 11,
  onRetry,
  onDismiss,
}: PlaybackErrorNoticeProps) {
  if (!error) return null;

  const formatted = formatPlaybackError(error);

  return (
    <output className={cn(className)} title={formatted.details}>
      <I.err size={iconSize} />
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {formatted.label}
      </span>
      {onRetry && (
        <IconButton
          icon={I.refresh}
          label="再試行"
          size="xs"
          className="shrink-0"
          onClick={onRetry}
        />
      )}
      {onDismiss && (
        <IconButton icon={I.x} label="閉じる" size="xs" className="shrink-0" onClick={onDismiss} />
      )}
    </output>
  );
}
