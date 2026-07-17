import { I } from "../../shared/ui/Icon";
import IconButton from "../../shared/ui/IconButton";

interface TopBarProps {
  mode?: "library" | "files";
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onScan?: () => void;
  onSettings?: () => void;
  isPlaying?: boolean;
  playingTrack?: string;
  /** スキャン実行中かどうか（TASK-20: SSE進捗表示） */
  scanning?: boolean;
  /** scanning 中の進捗ラベル（例: "作品を登録中 (3/12)"）。null は「進捗未受信」を表す */
  scanProgressLabel?: string | null;
  /** RJコード未検出の作品数（0件ならバッジを出さない、TASK-41） */
  rjCodeMissingCount?: number;
  /** 通知ベル押下でRJコード未検出一覧を開く */
  onOpenDlsiteMissing?: () => void;
  /** DLsite一括取得（mode: "existing"）が実行中か */
  dlsiteBulkActive?: boolean;
  /** dlsiteBulkActive 中の進捗（例: "3/12"）。null は進捗未受信 */
  dlsiteBulkProgress?: { processed: number; total: number } | null;
  /** 設定モーダルを開かずにライブラリ画面から一括取得を起動する */
  onStartDlsiteBulk?: () => void;
}

export default function TopBar({
  mode = "library",
  searchQuery,
  onSearchChange,
  onScan,
  onSettings,
  isPlaying = false,
  playingTrack,
  scanning = false,
  scanProgressLabel = null,
  rjCodeMissingCount = 0,
  onOpenDlsiteMissing,
  dlsiteBulkActive = false,
  dlsiteBulkProgress = null,
  onStartDlsiteBulk,
}: TopBarProps) {
  const placeholder =
    mode === "files"
      ? "このフォルダー内を検索（ファイル名 · 拡張子 ...）"
      : "ライブラリを検索（タイトル · CV · タグ · RJ ...）";

  return (
    <header className="mll-bar">
      <div className="mll-bar__brand">
        <div className="mll-bar__mark">m</div>
        <div className="mll-bar__name">mimimilli</div>
      </div>

      {isPlaying && playingTrack && (
        <>
          <div className="mll-bar__divider" />
          <div className="mll-bar__pulse">
            <span className="dot" />
            <span className="ch">1ch</span>
            <span className="sep">·</span>
            <span className="lbl">{playingTrack}</span>
          </div>
        </>
      )}

      <div className="mll-bar__spacer" />

      <div className="mll-bar__search">
        <I.search size={13} />
        <input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
        />
        {searchQuery ? (
          <IconButton
            size="sm"
            icon={I.x}
            label="検索をクリア"
            onClick={() => onSearchChange("")}
          />
        ) : (
          <span className="kbd">⌘K</span>
        )}
      </div>

      {scanning && (
        <span className="font-mono text-[10.5px] text-ink-3" aria-live="polite">
          {scanProgressLabel ?? "スキャン中..."}
        </span>
      )}
      <IconButton
        size="md"
        icon={I.refresh}
        label={scanning ? (scanProgressLabel ?? "スキャン中...") : "スキャン"}
        onClick={onScan}
        disabled={scanning}
        className={scanning ? "animate-spin" : undefined}
      />
      <IconButton
        size="md"
        icon={I.link}
        label={
          dlsiteBulkActive
            ? `DLsite未連携をまとめて取得中${dlsiteBulkProgress ? ` (${dlsiteBulkProgress.processed}/${dlsiteBulkProgress.total})` : "..."}`
            : "DLsite未連携をまとめて取得"
        }
        onClick={onStartDlsiteBulk}
        disabled={dlsiteBulkActive}
        className={dlsiteBulkActive ? "animate-pulse" : undefined}
      />
      <div className="relative">
        <IconButton
          size="md"
          icon={I.bell}
          label={
            rjCodeMissingCount > 0
              ? `通知（RJコード未検出の作品が${rjCodeMissingCount}件）`
              : "通知"
          }
          onClick={onOpenDlsiteMissing}
        />
        {rjCodeMissingCount > 0 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-0 flex h-[15px] min-w-[15px] items-center justify-center rounded-pill px-[3px] font-mono text-[9px] font-bold text-paper-1"
            style={{ background: "var(--r-coral)" }}
          >
            {rjCodeMissingCount > 99 ? "99+" : rjCodeMissingCount}
          </span>
        )}
      </div>
      <IconButton size="md" icon={I.cog} label="設定" onClick={onSettings} />
    </header>
  );
}
