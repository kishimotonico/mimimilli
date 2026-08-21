// アプリのシェルレイアウト。グリッド構造と各スロットへの配置のみを担当する。
// データ・ロジックは持たず、全て props 経由で受け取る。
//
// 再生UI（transportBar）は画面下張り付きバー / 右下ポップアップのいずれも
// position: fixed のオーバーレイとして自身の見た目を管理するため、
// グリッド行には含めない（PlayerDock 参照）。

import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { dockedBarActiveAtom } from "../entities/player/model/atoms";

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
  const dockedBarActive = useAtomValue(dockedBarActiveAtom);

  return (
    <div className={`mle-app ${dockedBarActive ? "has-docked-bar" : ""}`}>
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
