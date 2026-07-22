import { useEffect, useRef, useState } from "react";
import type { ScanResult } from "@mimimilli/shared";
import { I } from "../../shared/ui/Icon";
import IconButton from "../../shared/ui/IconButton";
import NotificationBell from "./NotificationBell";

interface TopBarProps {
  mode?: "library" | "files";
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onScan?: () => void;
  onCancelScan?: () => void;
  onSettings?: () => void;
  isPlaying?: boolean;
  playingTrack?: string;
  /** スキャン実行中かどうか（TASK-20: SSE進捗表示） */
  scanning?: boolean;
  /** scanning 中の進捗ラベル（例: "作品を登録中 (3/12)"）。null は「進捗未受信」を表す */
  scanProgressLabel?: string | null;
  /** RJコード未検出の作品数（0件ならバッジを出さない、TASK-41） */
  rjCodeMissingCount?: number;
  /** 通知ベルからRJコード未検出一覧を開く */
  onOpenRjCodeMissing?: () => void;
  /** DLsite取得失敗（error/not_found）の作品数（TASK-44） */
  dlsiteFetchFailedCount?: number;
  /** 通知ベルからDLsite取得失敗一覧を開く */
  onOpenDlsiteFetchFailed?: () => void;
  /** DLsite未連携（RJコードはあるが未取得）の作品数（TASK-44） */
  dlsiteUnlinkedCount?: number;
  /** DLsite一括取得（mode: "existing"）が実行中か */
  dlsiteBulkActive?: boolean;
  /** dlsiteBulkActive 中の進捗（例: "3/12"）。null は進捗未受信 */
  dlsiteBulkProgress?: { processed: number; total: number } | null;
  /** 通知ベルから一括取得を起動する */
  onStartDlsiteBulk?: () => void;
  /** 直近のスキャン結果（通知ベルのサマリ表示用、TASK-44） */
  scanResult?: ScanResult | null;
}

export default function TopBar({
  mode = "library",
  searchQuery,
  onSearchChange,
  onScan,
  onCancelScan,
  onSettings,
  isPlaying = false,
  playingTrack,
  scanning = false,
  scanProgressLabel = null,
  rjCodeMissingCount = 0,
  onOpenRjCodeMissing = () => {},
  dlsiteFetchFailedCount = 0,
  onOpenDlsiteFetchFailed = () => {},
  dlsiteUnlinkedCount = 0,
  dlsiteBulkActive = false,
  dlsiteBulkProgress = null,
  onStartDlsiteBulk = () => {},
  scanResult = null,
}: TopBarProps) {
  const placeholder =
    mode === "files"
      ? "このフォルダー内を検索（ファイル名 · 拡張子 ...）"
      : "ライブラリを検索（タイトル · CV · タグ · RJ ...）";

  // 検索入力はローカル draft を即時表示し、親への通知は IME composition 中は保留する
  // （composition 中間文字列でのリクエスト乱発を防ぐ。TASK-61）
  const [draft, setDraft] = useState(searchQuery);
  const composingRef = useRef(false);

  // クリアボタンやナビゲーション復元など、親側の値が外部要因で変わったときは draft を追従させる
  useEffect(() => {
    setDraft(searchQuery);
  }, [searchQuery]);

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
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (!composingRef.current) onSearchChange(e.target.value);
          }}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            onSearchChange(e.currentTarget.value);
          }}
          placeholder={placeholder}
        />
        {draft ? (
          <IconButton
            size="sm"
            icon={I.x}
            label="検索をクリア"
            onClick={() => {
              setDraft("");
              onSearchChange("");
            }}
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
      {scanning && onCancelScan && (
        <IconButton size="sm" icon={I.x} label="スキャンを中止" onClick={onCancelScan} />
      )}
      {dlsiteBulkActive && (
        <span className="font-mono text-[10.5px] text-ink-3" aria-live="polite">
          {dlsiteBulkProgress
            ? `DLsite取得中 (${dlsiteBulkProgress.processed}/${dlsiteBulkProgress.total})`
            : "DLsite取得中..."}
        </span>
      )}
      <NotificationBell
        rjCodeMissingCount={rjCodeMissingCount}
        onOpenRjCodeMissing={onOpenRjCodeMissing}
        dlsiteFetchFailedCount={dlsiteFetchFailedCount}
        onOpenDlsiteFetchFailed={onOpenDlsiteFetchFailed}
        dlsiteUnlinkedCount={dlsiteUnlinkedCount}
        dlsiteBulkActive={dlsiteBulkActive}
        dlsiteBulkProgress={dlsiteBulkProgress}
        onStartDlsiteBulk={onStartDlsiteBulk}
        scanResult={scanResult}
      />
      <IconButton size="md" icon={I.cog} label="設定" onClick={onSettings} />
    </header>
  );
}
