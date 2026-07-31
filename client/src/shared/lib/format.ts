// 表示用フォーマットユーティリティ。
// 依存なし（pure functions）。どの feature / entity からも import できる。

/** 秒数を "m:ss" または "h:mm:ss" 形式の文字列に変換する（経過時刻用。秒は切り捨て） */
export function formatTime(sec: number): string | null {
  if (!Number.isFinite(sec)) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** 総秒数を "m:ss" 形式の文字列に変換する（総再生時間表示用。秒は四捨五入） */
export function formatDuration(totalSec: number): string | null {
  if (!Number.isFinite(totalSec)) return null;
  return formatTime(Math.round(totalSec));
}

/** バイト数を "B / KB / MB" 形式の文字列に変換する */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
