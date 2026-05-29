// アプリのシェルレイアウト。グリッド構造と各スロットへの配置のみを担当する。
// データ・ロジックは持たず、全て props 経由で受け取る。

import type { ReactNode } from "react";

interface AppShellProps {
  /** 再生中かどうか（グリッド行高の切り替えに使用） */
  isPlaying: boolean;
  topBar: ReactNode;
  addressBar: ReactNode;
  leftNav: ReactNode;
  body: ReactNode;
  /** 再生バー or 空バー */
  transportBar: ReactNode;
  /** フルスクリーンプレイヤー（表示条件は呼び出し側で制御） */
  fullScreenPlayer?: ReactNode;
  /** 設定モーダル等のオーバーレイ */
  overlays?: ReactNode;
}

export default function AppShell({
  isPlaying,
  topBar,
  addressBar,
  leftNav,
  body,
  transportBar,
  fullScreenPlayer,
  overlays,
}: AppShellProps) {
  const mixerClass = isPlaying ? "is-mixer-single" : "is-mixer-empty";

  return (
    <div className="mle-app">
      <div className={`mle-frame is-lib ${mixerClass}`}>
        {topBar}
        {addressBar}
        {leftNav}
        <main className="mle-body">{body}</main>
        {transportBar}
      </div>

      {fullScreenPlayer}
      {overlays}
    </div>
  );
}
