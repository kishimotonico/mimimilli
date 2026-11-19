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

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "2026/11/08 17:49" 形式（ローカル時刻）。未実行（null）は「未実行」 */
export function formatScanDateTime(iso: string | null): string {
  if (!iso) return "未実行";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
