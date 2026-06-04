// 表示用フォーマットユーティリティ。
// 依存なし（pure functions）。どの feature / entity からも import できる。

/** 秒数を "m:ss" または "h:mm:ss" 形式の文字列に変換する */
export function formatTime(sec: number): string {
  if (!sec || !isFinite(sec)) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** 総秒数を "m:ss" 形式の文字列に変換する（totalDurationSec 表示用） */
export function formatDuration(totalSec: number): string {
  if (!totalSec) return "0:00";
  return formatTime(totalSec);
}

/** バイト数を "B / KB / MB" 形式の文字列に変換する */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
