import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { I } from "../../shared/ui/Icon";
import IconButton from "../../shared/ui/IconButton";
import { buttonClass } from "../../shared/ui/Button";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useMotionVariants } from "../../shared/ui/useMotionVariants";
import { activeModalAtom } from "../../shared/model/activeModalAtom";
import {
  dlsiteBulkActiveAtom,
  dlsiteBulkCancellingAtom,
  dlsiteBulkCurrentWorkLabelAtom,
  dlsiteBulkProgressLabelAtom,
} from "../../entities/dlsite/model/bulkAtoms";
import { useDlsiteBulkActions } from "../../entities/dlsite/useDlsiteBulkActions";
import { librarySearchQueryAtom } from "../../entities/library/model/navigationAtoms";
import { appModeAtom, setAppModeAtom } from "../../shared/model/appModeAtoms";
import {
  playerIsActiveAtom,
  playerStatusAtom,
  playingTrackTitleAtom,
} from "../../entities/player/model/atoms";
import { cn } from "../../shared/lib/cn";
import { scanningAtom, scanProgressLabelAtom } from "../../entities/scan/model/atoms";
import { useUnregisteredCandidateCount } from "../../features/scan/model/useScanCandidatesCache";

interface TopBarProps {
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
      className={buttonClass("danger-quiet", "sm", { className: "justify-center" })}
    >
      <I.x size={11} />
      中止
    </motion.button>
  );
}

export default function TopBar({ notificationBell }: TopBarProps) {
  const setActiveModal = useSetAtom(activeModalAtom);
  const scanning = useAtomValue(scanningAtom);
  const scanProgressLabel = useAtomValue(scanProgressLabelAtom);
  const unregisteredCount = useUnregisteredCandidateCount();
  const dlsiteBulkActive = useAtomValue(dlsiteBulkActiveAtom);
  const dlsiteBulkProgressLabel = useAtomValue(dlsiteBulkProgressLabelAtom);
  const dlsiteBulkCurrentWorkLabel = useAtomValue(dlsiteBulkCurrentWorkLabelAtom);
  const dlsiteBulkCancelling = useAtomValue(dlsiteBulkCancellingAtom);
  const { cancel: onCancelDlsiteBulk } = useDlsiteBulkActions();
  const mode = useAtomValue(appModeAtom);
  const setAppMode = useSetAtom(setAppModeAtom);
  const [searchQuery, onSearchChange] = useAtom(librarySearchQueryAtom);
  const isPlaying = useAtomValue(playerIsActiveAtom);
  const playingTrack = useAtomValue(playingTrackTitleAtom);
  const playerStatus = useAtomValue(playerStatusAtom);
  const isActivelyPlaying = playerStatus === "playing";
  const pulseLabel =
    playerStatus === "error" ? "再生エラー" : isActivelyPlaying ? "再生中" : "一時停止中";

  const placeholder = "ライブラリを検索（タイトル · CV · タグ · RJ ...）";

  // 検索入力はローカル draft を即時表示し、親への通知は IME composition 中は保留する
  // （composition 中間文字列でのリクエスト乱発を防ぐ。TASK-61）
  const [draft, setDraft] = useState(searchQuery);
  const composingRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Escapeで空欄からblurするとき、直前にフォーカスしていた要素へ戻すための記憶。
  // フォーカスは検索欄へ移った時点ですでに切り替わっているため、
  // FocusEvent.relatedTarget（移る前にフォーカスしていた要素）から取る。
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // クリアボタンやナビゲーション復元など、親側の値が外部要因で変わったときは draft を追従させる
  useEffect(() => {
    setDraft(searchQuery);
  }, [searchQuery]);

  // ⌘K / Ctrl+K で検索ボックスへフォーカスする。テキスト入力中は横取りしない。
  useEffect(() => {
    if (mode !== "library" && mode !== "workDetail") return;
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
          <div className="mll-bar__pulse" title={pulseLabel}>
            <span
              className={cn(
                "dot",
                isActivelyPlaying && "is-playing",
                playerStatus === "error" && "is-error",
              )}
              aria-label={pulseLabel}
            />
            <span className="ch">1ch</span>
            <span className="sep">·</span>
            <span className="lbl">{playingTrack}</span>
          </div>
        </>
      )}

      <div className="mll-bar__spacer" />

      {(mode === "library" || mode === "workDetail") && (
        <div className="mll-bar__search">
          <I.search size={13} />
          <input
            ref={searchInputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (!composingRef.current) onSearchChange(e.target.value);
            }}
            onFocus={(e) => {
              previousFocusRef.current = (e.relatedTarget as HTMLElement | null) ?? null;
            }}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={(e) => {
              composingRef.current = false;
              onSearchChange(e.currentTarget.value);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;

              if (e.key === "Enter") {
                // 作品詳細から確定したら検索結果（ライブラリ）へ移る
                if (mode === "workDetail") {
                  e.preventDefault();
                  setAppMode("library");
                }
                return;
              }

              if (e.key !== "Escape") return;
              // 一段だけ閉じる: 値があればクリアに留め、空のときだけblurして直前の
              // フォーカスへ戻す
              e.preventDefault();
              if (draft) {
                setDraft("");
                onSearchChange("");
                return;
              }
              e.currentTarget.blur();
              previousFocusRef.current?.focus();
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
        <span className="font-mono text-mono text-ink-2" aria-live="polite">
          {scanProgressLabel ?? "スキャン中..."}
        </span>
      )}
      <div className="relative">
        <IconButton
          size="md"
          icon={I.refresh}
          label={
            scanning
              ? (scanProgressLabel ?? "スキャン中...")
              : unregisteredCount > 0
                ? `スキャン（未登録${unregisteredCount}件）`
                : "スキャン"
          }
          onClick={() => setActiveModal({ kind: "scan" })}
          className={scanning ? "animate-spin" : undefined}
        />
        {!scanning && unregisteredCount > 0 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-0 flex h-[15px] min-w-[15px] items-center justify-center rounded-pill px-[3px] font-mono text-badge font-bold text-paper-1"
            style={{ background: "var(--acc)" }}
          >
            {unregisteredCount > 99 ? "99+" : unregisteredCount}
          </span>
        )}
      </div>
      {dlsiteBulkActive && (
        <>
          <span
            className="flex min-w-0 items-center gap-1 text-caption text-ink-2"
            aria-live="polite"
          >
            <span className="whitespace-nowrap font-mono">{dlsiteBulkProgressLabel}</span>
            {dlsiteBulkCurrentWorkLabel && (
              <span className="max-w-[220px] truncate" title={dlsiteBulkCurrentWorkLabel}>
                — {dlsiteBulkCurrentWorkLabel}
              </span>
            )}
          </span>
          <AnimatePresence initial={false}>
            {!dlsiteBulkCancelling && (
              <DlsiteBulkCancelButton onClick={() => void onCancelDlsiteBulk()} />
            )}
          </AnimatePresence>
        </>
      )}
      {notificationBell}
      <IconButton
        size="md"
        icon={I.cog}
        label="設定"
        onClick={() => setActiveModal({ kind: "settings" })}
      />
    </header>
  );
}
