---
id: TASK-109
title: clientのUI状態の購読位置を下げてルート再レンダリングを解消する
status: To Do
assignee: []
created_date: '2026-07-27 01:55'
updated_date: '2026-07-27 03:27'
labels:
  - client
  - performance
  - refactor
dependencies: []
priority: high
ordinal: 113000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
App.tsx が表示設定・ナビゲーション・プレイヤー・通知の state をすべてルートで購読しているため、どの操作でもアプリ全体が再レンダリングされる。

React 19.2 のレンダープロファイラで実測（作品11件のfixture）:
- グリッドサイズのスライダーを1px刻みで5回操作 → 480 renders / 41 コンポーネント。TopBar・LeftNav・PlayerDock・Toast・NotificationBell・軸レール（AxisRowItem 24個）まで毎tick再描画
- グリッドのタイルを1回クリック（作品選択）→ 567 renders / 54 コンポーネント。App が5連続で再描画

原因はルートでの過剰購読であり、React.memo の不足ではない（client/src 全体で memo は0件だが、購読位置を下げれば App 自体が再描画されなくなるので memo は原則不要）。memo を撒く方向ではなく、各 atom / query を必要なコンポーネントで購読する方向で解消する。

検討したが採用しない案:
- AppShell の element-as-prop を children 構文へ変更する: children でも要素は毎レンダー生成されるため効果がない。名前付きスロットはこの規模では可読性が高いので現状維持
- モーダル開閉の atom 化: 低頻度かつ排他的なので App 内の activeModal ユニオンで足りる。atom 化は暗黙の結合を増やすだけ
- React Compiler の導入: 購読位置に起因する再描画は解決しない
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 グリッドサイズのスライダー操作時に TopBar / LeftNav / PlayerDock / NotificationBell / AxisColumn が再レンダリングされない
- [ ] #2 作品選択（グリッドのタイルクリック）時に App が再レンダリングされない
- [ ] #3 リファクタ前後で表示・操作の挙動が変わらない（ビジュアルテストとユニットテストが通る）
- [ ] #4 React.memo の新規追加は、購読位置の変更では解消できない箇所に限られている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
計測手法の注意（サブタスク共通）:
agent-browser の `react renders` プロファイラは祖先コンポーネントを過剰カウントするため、このタスク系列の受け入れ判定には使えない。子のローカル useState を変えるだけの操作でも App まで再レンダーされたと記録される（TASK-109.1 で検証済み）。

代わりに countRender() 的な一時計装（各コンポーネント関数の先頭で window.__rc へ積算）でグラウンドトゥルースを取り、検証後に撤去する。React.StrictMode 有効なので表示値は論理レンダー数の2倍になる点に注意。

陰性対照（対象と無関係なリーフのローカル state を変える操作）と陽性対照（App の useState を変える操作）を必ず併せて取り、計装が効いていることを確認してから本題の数字を判定すること。
<!-- SECTION:NOTES:END -->
