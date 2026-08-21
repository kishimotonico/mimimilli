// 再生エラー表示。Bar / Popup / 再生中タブで共通利用する。

import type { AudioEngineError } from "../model/audioEngine";
import { formatPlaybackError } from "./formatPlaybackError";
import { I } from "../../../shared/ui/Icon";
import { cn } from "../../../shared/lib/cn";

interface PlaybackErrorNoticeProps {
  error: AudioEngineError | null;
  className?: string;
  iconSize?: number;
}

export default function PlaybackErrorNotice({
  error,
  className,
  iconSize = 11,
}: PlaybackErrorNoticeProps) {
  if (!error) return null;

  const formatted = formatPlaybackError(error);

  return (
    <output className={cn(className)} title={formatted.details}>
      <I.err size={iconSize} />
      {formatted.label}
    </output>
  );
}
