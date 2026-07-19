---
id: TASK-59
title: 作品グリッド・リストの仮想スクロール導入
status: To Do
assignee: []
created_date: '2026-07-19 02:02'
updated_date: '2026-07-19 04:26'
labels: []
dependencies:
  - TASK-73
priority: high
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
WorkGrid（client/src/features/library/ui/WorkGrid.tsx）はグリッド・リストとも全件をmap()でDOM化しており、仮想化がない。content-visibility:autoで描画は抑えられるがReact要素は全件生成され、30,000件で数十万DOMノード規模。ジャスティファイドレイアウトの計算・画像寸法確定ごとの全件再レイアウト、キーボード操作時の全タイルquerySelectorAll（O(N)）も問題。

方針: @tanstack/react-virtual 等による行単位の仮想化。TASK-73のページング（追加読み込み）と組み合わせる。リリース調整（Codexレビュー2026-07-19）: TASK-73でサーバーがデフォルトlimitを返すようになった時点で「次を読み込む」UIがないと残件へ到達できなくなるため、追加読み込みUIはTASK-73側で実装し本タスクはDOM最適化に専念する。キーボード移動は仮想化インデックス+レイアウト情報から算出（未マウント行へのスクロール+focus）。「画像寸法をDBへ保存して再レイアウトをなくす」案はサーバースキーマ・スキャナー・DTOを巻き込むため本タスクから除外し、必要なら別タスク化する。

2026-07-19のパフォーマンス調査で高優先度と判定。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 10,000件相当でも画面近傍の一定数だけがDOM化される
- [ ] #2 末尾スクロールで次ページが読み込まれる（TASK-73の追加読み込みと連動）
- [ ] #3 検索・軸・ソート変更時にスクロール位置とページ状態がリセットされる
- [ ] #4 矢印キーで未マウント行へ移動でき、スクロール+focusが追従する。aria-label・選択状態・Tab移動が退行しない
- [ ] #5 インスペクター開閉・タイルサイズ変更・1:1/ジャスティファイド切替後も表示位置・レイアウトが破綻しない（TASK-45の機能を退行させない）
- [ ] #6 pnpm check と pnpm test が通る
<!-- AC:END -->
