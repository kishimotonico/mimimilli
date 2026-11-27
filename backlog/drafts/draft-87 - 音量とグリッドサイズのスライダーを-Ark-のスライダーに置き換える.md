---
id: DRAFT-87
title: 音量とグリッドサイズのスライダーを Ark のスライダーに置き換える
status: Draft
assignee: []
created_date: '2026-11-27 13:58'
labels:
  - ui
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
同じ「音量」が4か所でネイティブ `<input type="range">` のまま、色・太さ・数値表示がばらばら（`accent-white`、`accent-[var(--ink-2)]`、`.mle-popup__volrange`、`.mle-bar1__volpop`）。キー操作の刻みもブラウザ依存。Ark のスライダーに置き換えて、見た目と操作をそろえたい。

対象（`type="range"` は5か所）: `BarVolumePopover`（ポップオーバーの中）、`PlayerTransportControls`（range 自体に `title={`音量 ${volume}%`}` が付いている）、`PopupContent`、`NowPlayingImmersiveMiniControls`、`LibraryGridControls`（グリッドサイズ。step=8、`disabled`）。
対象外: シークバー3面と AB ハンドル。自作の `role="slider"` のまま維持する（ADR-0043 に書く。Ark のスライダーにはホバー位置を返す口が無く、時刻表示と AB ハンドルは自作のまま残るため、置き換えの利益が小さい）。

ドラフトのままにしている理由: 見た目（トラックの太さ・色、サムの形・サイズ、数値の表示位置、没入モードだけ白系にするか）が未決。モックで相談してから起票する。

実装方針として決まっていること:
- スライダーにフォーカスしているときの Space は、グローバルの再生・一時停止のまま。`useGlobalShortcuts.ts` のコメントが既にこの方針を持っている。Ark の Thumb は `role="slider"` の要素になるので、`SHORTCUT_EXEMPT_SELECTOR`・`SLIDER_SELECTOR`・`usePopupDrag` の除外が、置き換え後も同じ挙動になるように直す
- キーの刻みは今の値を保つ（音量 1／10、グリッドサイズ step=8）。Ark の Slider は Home／End と Shift／PageUp の大きな刻みを持つ
- 音量・グリッドサイズの変更で親（App・一覧）を再レンダリングしない（`appRootSubscriptions.test` を保つ）
- `fireEvent.change` を使う unit（PopupContent.test、barContent.test）はキー・ポインター操作に置き換える
- `BarVolumePopover` では、ポップオーバーを開いたとき初期フォーカスがサム、Esc で閉じる（スライダーは Esc を奪わない）。ドラッグ中にポインターがポップオーバーの外へ出て離しても閉じない形にする
- 段階2の `BarVolumePopover` の構成が土台になる。TASK-529 のマージ後なら、段階4の前後どちらでもよい
<!-- SECTION:DESCRIPTION:END -->
