// 詳細パネルの再生スプリットボタン。主ボタン1つに再生アクションを集約し、
// 隣の▾から「最初から再生」を選べる（履歴あり/再生中のときのみ意味を持つ）。
// ▾メニューはLibrarySortMenuと同じパターン（外側クリック/Escape/フォーカス復帰は
// usePopoverDismissal、矢印キーでの項目移動は自前実装）に揃える。

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Track } from "@mimimilli/shared";
import { I, type IconFC } from "../../../../shared/ui/Icon";
import { usePopoverDismissal } from "./useAnchoredPopover";

interface WorkPlayButtonProps {
  hasResume: boolean;
  isPlayable: boolean;
  /** 選択中の作品が現在プレイヤーにロードされているか（再生中・一時停止中の両方を含む） */
  isLoaded: boolean;
  /** isLoaded かつ実際に再生中か */
  isPlaying: boolean;
  resumeTrack: Track | null;
  resumeTime: string;
  /** 先頭（トラック0）から再生を開始する */
  onPlayFromStart: () => void;
  /** レジューム位置から再生を開始する */
  onResume: () => void;
  /** ロード中のトラックの再生/一時停止を切り替える */
  onTogglePlay: () => void;
}

interface MainAction {
  icon: IconFC;
  /** ボタンに表示する短い文言。時間テキストは載せない */
  text: string;
  /** 支援技術向けのアクセシブル名。textより状態が明確に伝わる言い回しにする */
  label: string;
  onClick: () => void;
}

function getMainAction(props: WorkPlayButtonProps): MainAction {
  const { isPlayable, isLoaded, isPlaying, hasResume, onPlayFromStart, onResume, onTogglePlay } =
    props;
  if (isLoaded) {
    return isPlaying
      ? { icon: I.pause, text: "一時停止", label: "一時停止", onClick: onTogglePlay }
      : { icon: I.play, text: "再生", label: "再生を再開", onClick: onTogglePlay };
  }
  if (hasResume && isPlayable) {
    return { icon: I.play, text: "続きから", label: "続きから再生", onClick: onResume };
  }
  return { icon: I.play, text: "再生", label: "最初から再生", onClick: onPlayFromStart };
}

export function WorkPlayButton(props: WorkPlayButtonProps) {
  const { isPlayable, isLoaded, hasResume, resumeTrack, resumeTime, onPlayFromStart } = props;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { close: closeMenu } = usePopoverDismissal({
    isOpen: isMenuOpen,
    onClose: () => setIsMenuOpen(false),
    anchorRef: rootRef,
  });

  useEffect(() => {
    if (!isMenuOpen) return;
    rootRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [isMenuOpen]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    );
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (currentIndex + delta + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  const main = getMainAction(props);
  const MainIcon = main.icon;
  // ▾は「最初から再生」が主ボタンと別の意味を持つときだけ出す。ロード中（再生/一時停止）
  // か、非ロードで履歴ありのときは主ボタンが「続きから」/トグルなので▾に意味がある。
  // 非ロードで履歴なしは主ボタン自体が既に「最初から再生」なので▾は省略する。
  const showMenuTrigger = isPlayable && (isLoaded || hasResume);
  const title =
    resumeTrack && hasResume ? `${resumeTrack.title} · ${resumeTime} から再開` : main.label;

  return (
    <div className="mle-prv__playsplit" ref={rootRef}>
      <button
        type="button"
        className={`mle-prv__playbtn ${showMenuTrigger ? "has-caret" : ""}`}
        disabled={!isPlayable}
        aria-disabled={!isPlayable}
        aria-label={main.label}
        title={title}
        onClick={main.onClick}
      >
        <MainIcon size={12} />
        <span>{main.text}</span>
      </button>
      {showMenuTrigger && (
        <button
          type="button"
          className="mle-prv__playcaret"
          aria-label="再生メニュー"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <I.chevD size={11} />
        </button>
      )}
      {isMenuOpen && (
        <div
          className="mle-prv__playmenu"
          role="menu"
          aria-label="再生メニュー"
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
        >
          <button
            type="button"
            role="menuitem"
            className="mle-prv__playmenu-item"
            onClick={() => {
              closeMenu();
              onPlayFromStart();
            }}
          >
            <I.refresh size={12} />
            <span>最初から再生</span>
          </button>
        </div>
      )}
    </div>
  );
}
