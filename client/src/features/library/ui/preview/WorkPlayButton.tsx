// 詳細パネルの再生スプリットボタン。主ボタン1つに再生アクションを集約し、
// 隣の▾から「最初から再生」を選べる（履歴あり/再生中のときのみ意味を持つ）。

import { Menu } from "@ark-ui/react/menu";
import type { Track } from "@mimimilli/shared";
import { I, type IconFC } from "../../../../shared/ui/Icon";
import {
  MenuPopup,
  MotionMenuRoot,
  MotionMenuTrigger,
  useMotionMenu,
} from "../../../../shared/ui/menu/MotionMenu";
import { MENU_LABEL_CLASS, menuItemClass } from "../../../../shared/ui/menu/menuStyles";

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
  const main = getMainAction(props);
  const MainIcon = main.icon;
  // ▾は「最初から再生」が主ボタンと別の意味を持つときだけ出す。ロード中（再生/一時停止）
  // か、非ロードで履歴ありのときは主ボタンが「続きから」/トグルなので▾に意味がある。
  // 非ロードで履歴なしは主ボタン自体が既に「最初から再生」なので▾は省略する。
  const showMenuTrigger = isPlayable && (isLoaded || hasResume);
  const title =
    resumeTrack && hasResume ? `${resumeTrack.title} · ${resumeTime} から再開` : main.label;

  return (
    <div className="mle-prv__playsplit">
      <button
        type="button"
        className={`mle-prv__playbtn ${showMenuTrigger ? "has-caret" : ""}`}
        disabled={!isPlayable}
        aria-label={main.label}
        title={title}
        onClick={main.onClick}
      >
        <MainIcon size={12} />
        <span>{main.text}</span>
      </button>
      {showMenuTrigger && <PlayFromStartMenu onPlayFromStart={onPlayFromStart} />}
    </div>
  );
}

/** ▾の「最初から再生」。▾が消えるとき開いた状態を持ち越さないよう、メニューの状態ごとこの部品に閉じる */
function PlayFromStartMenu({ onPlayFromStart }: { onPlayFromStart: () => void }) {
  const menu = useMotionMenu({ positioning: { placement: "bottom-end" } });
  return (
    <MotionMenuRoot handle={menu}>
      <MotionMenuTrigger>
        <button type="button" className="mle-prv__playcaret" aria-label="再生メニュー">
          <I.chevD size={11} />
        </button>
      </MotionMenuTrigger>
      <MenuPopup aria-label="再生メニュー">
        <Menu.Item
          value="play-from-start"
          valueText="最初から再生"
          onSelect={onPlayFromStart}
          className={menuItemClass()}
        >
          <span className={MENU_LABEL_CLASS}>最初から再生</span>
        </Menu.Item>
      </MenuPopup>
    </MotionMenuRoot>
  );
}
