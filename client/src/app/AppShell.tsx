// アプリのシェルレイアウト。グリッド構造と各スロットへの配置のみを担当する。
// データ・ロジックは持たず、全て props 経由で受け取る。
//
// 再生UI（transportBar）は画面下張り付きバー / 右下ポップアップのいずれも
// position: fixed のオーバーレイとして自身の見た目を管理するため、
// グリッド行には含めない（PlayerDock 参照）。

import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { playerDockBarVisibleAtom } from "../features/player/model/playerPresentationAtoms";
import { layerAtom } from "../entities/navigation/model/appRouteStore";
import { librarySidebarVisibleAtom } from "../features/library/model/sidebarAtoms";

interface AppShellProps {
  topBar: ReactNode;
  addressBar: ReactNode;
  /** ライブラリ・作品詳細の左のサイドバー。出す・隠すは AppShell が決める */
  sidebar: ReactNode;
  body: ReactNode;
  /** 今の画面に重なる層（再生中）。開いていなければ何も描画しない */
  layer: ReactNode;
  /** 常駐再生UI（PlayerDock。fixed オーバーレイなので自身で表示/非表示を制御する） */
  transportBar: ReactNode;
  /** 設定モーダル等のオーバーレイ */
  overlays?: ReactNode;
}

export default function AppShell({
  topBar,
  addressBar,
  sidebar,
  body,
  layer,
  transportBar,
  overlays,
}: AppShellProps) {
  const dockBarVisible = useAtomValue(playerDockBarVisibleAtom);
  const layerOpen = useAtomValue(layerAtom) !== null;
  // 層が開いている間は PlayerDock 自体を描画しないため、docked bar 用の余白確保も対象外にする。
  const dockedBarActive = dockBarVisible && !layerOpen;
  const sidebarVisible = useAtomValue(librarySidebarVisibleAtom);

  return (
    <div className={`mle-app ${dockedBarActive ? "has-docked-bar" : ""}`}>
      <div className={`mle-frame is-lib ${sidebarVisible ? "has-sidebar" : ""}`}>
        {topBar}
        <div className="contents" inert={layerOpen}>
          {addressBar}
          {sidebarVisible && sidebar}
        </div>
        <main className="mle-body" inert={layerOpen}>
          {body}
        </main>
      </div>
      {layer}

      {transportBar}
      {overlays}
    </div>
  );
}
