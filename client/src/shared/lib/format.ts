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

export function formatLastScanTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("ja-JP") : "未実行";
}

/** スキャンモーダル左リスト用の短い日時表示。当日は時刻のみ、それ以外は "8/13 09:12" 形式。 */
export function formatScanSidebarTime(iso: string | null): string {
  if (!iso) return "未実行";
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return sameDay ? time : `${date.getMonth() + 1}/${date.getDate()} ${time}`;
}
