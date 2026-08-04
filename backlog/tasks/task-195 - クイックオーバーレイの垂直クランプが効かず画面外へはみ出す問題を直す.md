---
id: TASK-195
title: クイックオーバーレイの垂直クランプが効かず画面外へはみ出す問題を直す
status: To Do
assignee: []
created_date: '2026-08-04 17:34'
labels: []
dependencies: []
priority: high
ordinal: 205000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
実機検証（2026-08-05）で見つかった TASK-191 のリグレッション。値8件程度でも再現するため実運用で高頻度に踏む。マージ前に解消する。

## 症状

CV軸行にホバーするだけで再現。オーバーレイの下端が画面外へはみ出し、末尾の項目が見えなくなる。実測ではビューポート高さ577pxに対しオーバーレイのbottomが611pxで、8件中2件が完全に画面外。内部スクロールコンテナは overflow-y:auto だが、コンテナ自体が画面外にあるためスクロールしても見えない。

キーボードの下方向移動でも同じ影響を受ける。コンテナ内でのフォーカス追従ロジック自体は正しく動いているが、コンテナが画面外にあるためフォーカス中の項目が不可視になる（同一原因の派生）。

## 原因

client/src/features/library/ui/AxisQuickOverlay.tsx の位置計算（78〜88行目付近）。

- useLayoutEffect の依存配列が [isOpen, anchorEl] のみで、サイズ変化のトリガーを含まない
- 初回は position が null でパネル未描画のため panelRef.current が null
- estimatedHeight = Math.min(360, panelRef.current?.offsetHeight ?? 240) が常に固定値240になる
- 実際の値一覧が描画されて実高さ（8件で282px、多件数ではCSS上限360px）に達しても再計算されない

結果、実高さより小さい見積もりで天井位置を決めるためはみ出す。

## 対応方針（統括判断）

自前の位置計算にサイズ追従を足し込むのではなく、**共有フック useAnchoredPopover を使う形へ戻す**。

TASK-191 で右側表示にする際、AxisQuickOverlay は useAnchoredPopover への依存を外して位置計算を自前実装した。その結果、共有フックが持っていた ResizeObserver による実サイズ追従を失ったのが今回の原因である。チップの兄弟値ドロップダウン（AxisValuePopoverPanel）は共有フックのままなので同じ問題を抱えていない。

したがって useAnchoredPopover に右側配置（アンカーの右隣に置き、垂直方向は画面内へクランプする）のモードを追加し、AxisQuickOverlay をそれに載せ替える。位置決めの実装を2つ持たない状態へ戻すことが対応の主眼で、はみ出しの解消はその結果として得られるべきものとする。

既存の利用箇所（ソートメニュー・タグエディタ・メタデータ操作・通知ベル・チップの兄弟値ドロップダウン）を壊さないこと。

対象: client/src/features/library/ui/preview/useAnchoredPopover.ts / AxisQuickOverlay.tsx
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 軸レールの最下部付近の行で開いても、オーバーレイが画面外へはみ出さず全項目が見える
- [ ] #2 値が多い軸でオーバーレイの高さが上限に達しても画面内に収まる
- [ ] #3 キーボードの下方向移動でフォーカス中の項目が常に画面内に見えている
- [ ] #4 位置決めが useAnchoredPopover に一本化され、AxisQuickOverlay に独自の位置計算が残っていない
- [ ] #5 パネルの実サイズが変化したとき（値の読み込み完了・検索での絞り込み・ソート展開）に位置が追従する
- [ ] #6 useAnchoredPopover の既存利用箇所（ソートメニュー・タグエディタ・メタデータ操作・通知ベル・チップの兄弟値ドロップダウン）が壊れていない
- [ ] #7 pnpm check と pnpm test が通る
<!-- AC:END -->
