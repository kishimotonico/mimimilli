// アプリのシェルレイアウト。グリッド構造と各スロットへの配置のみを担当する。
// データ・ロジックは持たず、全て props 経由で受け取る。
//
// 再生UI（transportBar）は画面下張り付きバー / 右下ポップアップのいずれも
// position: fixed のオーバーレイとして自身の見た目を管理するため、
// グリッド行には含めない（PlayerDock 参照）。

import { useAtomValue } from "jotai";
import type { CSSProperties, ReactNode } from "react";
import {
  playerDockBarVisibleAtom,
  playerDockPopupVisibleAtom,
  playerPopupAtOriginAtom,
  playerPopupMeasuredHeightAtom,
} from "../features/player/model/playerPresentationAtoms";
import { appModeAtom } from "../shared/model/appModeAtoms";

interface AppShellProps {
  topBar: ReactNode;
  addressBar: ReactNode;
  leftNav: ReactNode;
  body: ReactNode;
  /** 常駐再生UI（PlayerDock。fixed オーバーレイなので自身で表示/非表示を制御する） */
  transportBar: ReactNode;
  /** 設定モーダル等のオーバーレイ */
  overlays?: ReactNode;
}

export default function AppShell({
  topBar,
  addressBar,
  leftNav,
  body,
  transportBar,
  overlays,
}: AppShellProps) {
  const dockBarVisible = useAtomValue(playerDockBarVisibleAtom);
  const dockPopupVisible = useAtomValue(playerDockPopupVisibleAtom);
  const popupAtOrigin = useAtomValue(playerPopupAtOriginAtom);
  const popupHeight = useAtomValue(playerPopupMeasuredHeightAtom);
  const isNowPlaying = useAtomValue(appModeAtom) === "nowPlaying";
  // 再生中タブでは PlayerDock 自体を描画しないため、docked bar / popup 用の余白確保も対象外にする。
  const dockedBarActive = dockBarVisible && !isNowPlaying;
  // ドラッグで初期位置から動かされている間は、ユーザーが置き場所を決めたとみなし余白を付けない。
  const dockedPopupActive = dockPopupVisible && !isNowPlaying && popupAtOrigin;

  const appClassName = [
    "mle-app",
    dockedBarActive ? "has-docked-bar" : "",
    dockedPopupActive ? "has-docked-popup" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const appStyle = dockedPopupActive
    ? ({ "--popup-h": `${popupHeight}px` } as CSSProperties)
    : undefined;

  return (
    <div className={appClassName} style={appStyle}>
      <div className="mle-frame is-lib">
        {topBar}
        {addressBar}
        {leftNav}
        <main className="mle-body">{body}</main>
      </div>

      {transportBar}
      {overlays}
    </div>
  );
}
