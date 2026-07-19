---
id: TASK-59
title: 作品グリッド・リストの仮想スクロール導入
status: To Do
assignee: []
created_date: '2026-07-19 02:02'
labels: []
dependencies:
  - TASK-58
priority: high
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
WorkGrid（client/src/features/library/ui/WorkGrid.tsx）はグリッド・リストとも全件をmap()でDOM化しており、仮想化がない。content-visibility:autoで描画は抑えられるがReact要素は全件生成され、30,000件で数十万DOMノード規模。ジャスティファイドレイアウトの計算・画像寸法確定ごとの全件再レイアウト、キーボード操作時の全タイルquerySelectorAll（O(N)）も問題。

方針: @tanstack/react-virtual 等による行単位の仮想化。TASK-58のページングと組み合わせてクライアント保持件数にも上限を設ける。画像寸法はDBに保存して読込後の全件再レイアウトをなくすことも検討。キーボード移動は仮想化インデックス+レイアウト情報から算出する。

2026-07-19のパフォーマンス調査で高優先度と判定。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 グリッド・リストとも画面近傍の項目だけがDOM化される（数千件でもDOMノード数が一定規模に収まる）
- [ ] #2 既存のキーボードナビゲーション・選択・プレビュー動作が維持される
- [ ] #3 ジャスティファイド/1:1タイル両表示形式で動作する（TASK-45の機能を退行させない）
- [ ] #4 pnpm check と pnpm test が通る
<!-- AC:END -->
