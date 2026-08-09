import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { I } from "../../shared/ui/Icon";
import IconButton from "../../shared/ui/IconButton";
import { useAtom, useAtomValue } from "jotai";
import { useMotionVariants } from "../../shared/ui/useMotionVariants";
import {
  dlsiteBulkActiveAtom,
  dlsiteBulkCancellingAtom,
  dlsiteBulkProgressAtom,
} from "../../entities/dlsite/model/bulkAtoms";
import { useDlsiteBulkActions } from "../../entities/dlsite/useDlsiteBulkActions";
import { librarySearchQueryAtom } from "../../entities/library/model/navigationAtoms";
import { appModeAtom } from "../../shared/model/appModeAtoms";
import { playerIsActiveAtom, playingTrackTitleAtom } from "../../entities/player/model/atoms";
import { scanningAtom, scanProgressLabelAtom } from "../../entities/scan/model/atoms";

interface TopBarProps {
  /** スキャンボタン押下時。即時実行はせずスキャンモーダルを開く（TASK-56） */
  onOpenScan: () => void;
  onSettings: () => void;
  notificationBell: ReactNode;
}

function DlsiteBulkCancelButton({ onClick }: { onClick: () => void }) {
  const { fade } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fade();
  return (
    <motion.button
      type="button"
      inert={!isPresent}
      {...v}
      onClick={onClick}
      className="inline-flex h-7 items-center justify-center gap-1 rounded-[6px] border border-[color-mix(in_oklch,var(--r-coral)_45%,transparent)] bg-[color-mix(in_oklch,var(--r-coral)_10%,transparent)] px-2.5 font-sans text-[11px] font-medium text-ink-0 transition-colors hover:bg-[color-mix(in_oklch,var(--r-coral)_16%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-acc focus-visible:outline-offset-2"
    >
      <I.x size={11} />
      中止
    </motion.button>
  );
}

export default function TopBar({ onOpenScan, onSettings, notificationBell }: TopBarProps) {
  const scanning = useAtomValue(scanningAtom);
  const scanProgressLabel = useAtomValue(scanProgressLabelAtom);
  const dlsiteBulkActive = useAtomValue(dlsiteBulkActiveAtom);
  const dlsiteBulkProgress = useAtomValue(dlsiteBulkProgressAtom);
  const dlsiteBulkCancelling = useAtomValue(dlsiteBulkCancellingAtom);
  const { cancel: onCancelDlsiteBulk } = useDlsiteBulkActions();
  const mode = useAtomValue(appModeAtom);
  const [searchQuery, onSearchChange] = useAtom(librarySearchQueryAtom);
  const isPlaying = useAtomValue(playerIsActiveAtom);
  const playingTrack = useAtomValue(playingTrackTitleAtom);

  const placeholder = "ライブラリを検索（タイトル · CV · タグ · RJ ...）";

  // 検索入力はローカル draft を即時表示し、親への通知は IME composition 中は保留する
  // （composition 中間文字列でのリクエスト乱発を防ぐ。TASK-61）
  const [draft, setDraft] = useState(searchQuery);
  const composingRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // クリアボタンやナビゲーション復元など、親側の値が外部要因で変わったときは draft を追従させる
  useEffect(() => {
    setDraft(searchQuery);
  }, [searchQuery]);

  // ⌘K / Ctrl+K で検索ボックスへフォーカスする。テキスト入力中は横取りしない。
  useEffect(() => {
    if (mode === "files") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      const isEditable =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (isEditable && target !== searchInputRef.current) return;
      e.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode]);

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
            ref={searchInputRef}
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
          <AnimatePresence initial={false}>
            {!dlsiteBulkCancelling && (
              <DlsiteBulkCancelButton onClick={() => void onCancelDlsiteBulk()} />
            )}
          </AnimatePresence>
        </>
      )}
      {notificationBell}
      <IconButton size="md" icon={I.cog} label="設定" onClick={onSettings} />
    </header>
  );
}
