import { I } from "../../../../shared/ui/Icon";
import { formatDuration } from "./format";
import type { CollectionStatsDisplay } from "../../model/libraryPresentation";

interface CollectionPlaceholderProps {
  message: string;
  hint?: string;
  /** 表示中コレクションの統計。省略時は行自体を出さない（loading と同じ扱い） */
  stats?: CollectionStatsDisplay;
}

/** グリッド詳細パネルの未選択時表示とリストモードのプレビュー空表示で共有する
 *  プレースホルダー。中央寄せ・ミュートカラーのアイコン＋案内文をベースに、
 *  控えめな1行で表示中コレクションの統計を添える。 */
export function CollectionPlaceholder({ message, hint, stats }: CollectionPlaceholderProps) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
      }}
    >
      {/* 広いビューポートで案内文だけが間延びしないよう、内容は maxWidth で頭打ちにする */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          maxWidth: 320,
          padding: "28px 24px",
          borderRadius: "var(--r-3)",
          background: "var(--paper-2)",
          color: "var(--ink-4)",
          textAlign: "center",
        }}
      >
        <I.gridS size={28} />
        <span style={{ fontSize: 12 }}>{message}</span>
        {hint && <span style={{ fontSize: 11 }}>{hint}</span>}
        {stats?.status === "error" && (
          <span style={{ fontSize: 10.5, color: "var(--ink-3)" }}>統計の取得に失敗しました</span>
        )}
        {stats?.status === "ready" && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--ink-3)",
            }}
          >
            {stats.count}作品 · {stats.trackCount}トラック ·{" "}
            {formatDuration(stats.durationSec) ?? "0:00"}
          </span>
        )}
      </div>
    </div>
  );
}
