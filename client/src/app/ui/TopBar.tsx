import { useEffect, useRef, useState, type ReactNode } from "react";
import { I } from "../../shared/ui/Icon";
import IconButton from "../../shared/ui/IconButton";
import { useAtom, useAtomValue } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { librarySearchQueryAtom } from "../../features/library/model/atoms";
import { appModeAtom } from "../../features/navigation/model/navigationAtoms";
import { playerIsActiveAtom, playingTrackTitleAtom } from "../../features/player/model/atoms";

const FADE = { duration: 0.15 };

interface TopBarProps {
  /** スキャンボタン押下時。即時実行はせずスキャンモーダルを開く（TASK-56） */
  onOpenScan?: () => void;
  onSettings?: () => void;
  /** スキャン実行中かどうか（TASK-20: SSE進捗表示） */
  scanning?: boolean;
  /** scanning 中の進捗ラベル（例: "作品を登録中 (3/12)"）。null は「進捗未受信」を表す */
  scanProgressLabel?: string | null;
  notificationBell: ReactNode;
  /** DLsite一括取得（mode: "existing"）が実行中か */
  dlsiteBulkActive?: boolean;
  /** dlsiteBulkActive 中の進捗（例: "3/12"）。null は進捗未受信 */
  dlsiteBulkProgress?: { processed: number; total: number } | null;
  /** DLsite一括取得を中止する */
  onCancelDlsiteBulk?: () => void;
  /** DLsite一括取得の中止を要求済みか */
  dlsiteBulkCancelling?: boolean;
}

export default function TopBar({
  onOpenScan,
  onSettings,
  scanning = false,
  scanProgressLabel = null,
  notificationBell,
  dlsiteBulkActive = false,
  dlsiteBulkProgress = null,
  onCancelDlsiteBulk = () => {},
  dlsiteBulkCancelling = false,
}: TopBarProps) {
  const mode = useAtomValue(appModeAtom);
  const [searchQuery, onSearchChange] = useAtom(librarySearchQueryAtom);
  const isPlaying = useAtomValue(playerIsActiveAtom);
  const playingTrack = useAtomValue(playingTrackTitleAtom);

  const placeholder = "ライブラリを検索（タイトル · CV · タグ · RJ ...）";

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

      {mode !== "files" && (
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
      )}

      {scanning && (
        <span className="font-mono text-[10.5px] text-ink-3" aria-live="polite">
          {scanProgressLabel ?? "スキャン中..."}
        </span>
      )}
      <IconButton
        size="md"
        icon={I.refresh}
        label={scanning ? (scanProgressLabel ?? "スキャン中...") : "スキャン"}
        onClick={onOpenScan}
        className={scanning ? "animate-spin" : undefined}
      />
      {dlsiteBulkActive && (
        <>
          <span className="font-mono text-[10.5px] text-ink-3" aria-live="polite">
            {dlsiteBulkProgress
              ? `DLsite取得中 (${dlsiteBulkProgress.processed}/${dlsiteBulkProgress.total})`
              : "DLsite取得中..."}
          </span>
          <AnimatePresence mode="wait" initial={false}>
            {!dlsiteBulkCancelling && (
              <motion.button
                type="button"
                key="cancel-dlsite-bulk"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FADE}
                onClick={onCancelDlsiteBulk}
                className="inline-flex h-7 items-center justify-center gap-1 rounded-[6px] border border-[color-mix(in_oklch,var(--r-coral)_45%,transparent)] bg-[color-mix(in_oklch,var(--r-coral)_10%,transparent)] px-2.5 font-sans text-[11px] font-medium text-ink-0 transition-colors hover:bg-[color-mix(in_oklch,var(--r-coral)_16%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-acc focus-visible:outline-offset-2"
              >
                <I.x size={11} />
                中止
              </motion.button>
            )}
          </AnimatePresence>
        </>
      )}
      {notificationBell}
      <IconButton size="md" icon={I.cog} label="設定" onClick={onSettings} />
    </header>
  );
}
