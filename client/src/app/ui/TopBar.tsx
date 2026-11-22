import { useEffect, useRef, useState } from "react";
import { I } from "../../shared/ui/Icon";
import IconButton from "../../shared/ui/IconButton";
import ToolButton from "../../shared/ui/ToolButton";
import { useAtomValue, useSetAtom } from "jotai";
import { activeModalAtom } from "../../shared/model/activeModalAtom";
import { useLibraryNavigation } from "../../features/library/model/useLibraryNavigation";
import { appModeAtom, setAppModeAtom } from "../../entities/navigation/model/appRouteStore";
import {
  playerIsActiveAtom,
  playerStatusAtom,
  playingTrackTitleAtom,
} from "../../entities/player/model/atoms";
import { cn } from "../../shared/lib/cn";
import { useScanEntryStatus } from "../../features/scan/model/useScanEntryStatus";
import ScanEntryButton from "./ScanEntryButton";

export default function TopBar() {
  const setActiveModal = useSetAtom(activeModalAtom);
  const { ring, unseen } = useScanEntryStatus();
  const mode = useAtomValue(appModeAtom);
  const setAppMode = useSetAtom(setAppModeAtom);
  const nav = useLibraryNavigation();
  const onSearchChange = nav.setSearchQuery;
  const searchQuery = nav.foldersStatus === "ready" ? nav.searchQuery : "";
  // 一覧が来るまでは検索の行き先（その一覧か「すべて」か）が決まらないので入力させない
  const isSearchDisabled = nav.foldersStatus !== "ready" || mode === "files";
  const isPlaying = useAtomValue(playerIsActiveAtom);
  const playingTrack = useAtomValue(playingTrackTitleAtom);
  const playerStatus = useAtomValue(playerStatusAtom);
  const isActivelyPlaying = playerStatus === "playing";
  const pulseLabel =
    playerStatus === "error" ? "再生エラー" : isActivelyPlaying ? "再生中" : "一時停止中";

  const placeholder = "ライブラリを検索（タイトル · CV · タグ · RJ ...）";

  // 検索入力はローカル draft を即時表示し、親への通知は IME composition 中は保留する
  // （composition 中間文字列でのリクエスト乱発を防ぐ）
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
      const target = e.target instanceof HTMLElement ? e.target : null;
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
            <span className="lbl">{playingTrack}</span>
          </div>
        </>
      )}

      <div className="mll-bar__spacer" />

      {(mode === "library" || mode === "workDetail" || mode === "files") && (
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
              previousFocusRef.current =
                e.relatedTarget instanceof HTMLElement ? e.relatedTarget : null;
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
            disabled={isSearchDisabled}
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

      <ToolButton
        icon={I.folder}
        active={mode === "files"}
        onClick={() => setAppMode(mode === "files" ? "library" : "files")}
      >
        ファイル
      </ToolButton>
      <ScanEntryButton
        ring={ring}
        unseen={unseen}
        onOpen={() => setActiveModal({ kind: "scan" })}
      />
      <IconButton
        size="md"
        icon={I.cog}
        label="設定"
        onClick={() => setActiveModal({ kind: "settings" })}
      />
    </header>
  );
}
