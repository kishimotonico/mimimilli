---
id: TASK-109.1
title: グリッド表示設定atomの購読をAddressBarとWorkGridへ降ろす
status: Done
assignee: []
created_date: '2026-07-27 01:55'
updated_date: '2026-07-27 03:30'
labels: []
dependencies: []
parent_task_id: TASK-109
priority: high
ordinal: 114000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
libraryTileSizeAtom / libraryViewModeAtom / libraryGridLayoutModeAtom を App.tsx:59-61 でルート購読しているのをやめ、実際に使うコンポーネントで購読する。この3つの atom の購読者は現状 App だけで、App → AddressBar と App → LibraryView → WorkGrid の3段 props ドリルになっている。

方針:
- AddressBar のグリッド操作部（ratio切替・サイズスライダー）を LibraryGridControls として切り出し、そこで atom を購読する
- WorkGrid も tileSize / gridLayoutMode を直接購読する（ctrl+wheel のズームも setter を直接使う）
- App / LibraryView から tileSize・onTileSizeChange・gridLayoutMode・viewMode の props を削除する

atomWithStorage のドラッグ中の localStorage 書き込みはこのタスクでは扱わない（別途、計測してから判断する）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 libraryTileSizeAtom / libraryGridLayoutModeAtom / libraryViewModeAtom を App.tsx が購読していない
- [x] #2 tileSize・onTileSizeChange・gridLayoutMode を props として受け渡している箇所がない
- [x] #3 スライダー操作・ctrl+wheelズーム・表示形式切替が従来どおり動作する
- [x] #4 スライダー操作時に TopBar / LeftNav / PlayerDock が再レンダリングされない
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. libraryTileSizeAtom / libraryGridLayoutModeAtom / libraryViewModeAtom の購読者を洗い出す
2. AddressBar のグリッド操作部（1:1/原寸トグル + サイズスライダー）を LibraryGridControls として切り出し、そこで3 atom を購読する
3. AddressBar の viewMode トグルも library モードでは atom 購読へ寄せる（files モードは column 固定なので props で分岐を残す）
4. WorkGrid が tileSize / gridLayoutMode を直接購読し、ctrl+wheel も setter を直接呼ぶ
5. LibraryView から tileSize / onTileSizeChange / gridLayoutMode / viewMode の props を削除
6. App.tsx から useAtom 3件と関連 props を削除
7. pnpm check / pnpm test / ビジュアルテストを通し、レンダープロファイラで AC#4 を実測確認
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装完了（Cursorへ委譲 + 統括側で微修正）。

変更:
- 新規 client/src/features/library/ui/LibraryGridControls.tsx に1:1/原寸トグルとサイズスライダーを切り出し、libraryTileSizeAtom / libraryGridLayoutModeAtom / libraryViewModeAtom を自身で購読
- AddressBar は props 7個（viewMode / onViewChange / availableViewModes / tileSize / onTileSizeChange / gridLayoutMode / onGridLayoutModeChange）を廃止し、mode を required に。libraryViewModeAtom を自身で購読
- WorkGrid は tileSize / gridLayoutMode / onTileSizeChange の props を廃止し atom 直接購読。ctrl+wheel も setter を直接呼ぶ
- LibraryView は props 4個を廃止し、showGrid 判定用の viewMode のみ購読
- App.tsx から useAtom 3件と関連 props を削除（26行減）

統括側の追加修正:
- AddressBar のカラムボタンの空 onClick を削除（files モードでは唯一の選択肢、library では disabled のため無意味だった）
- リスト/グリッドの if (mode === "library") ガードを削除（disabled 済みで到達不能な防御コード）
- WorkGrid.test.tsx のスクロールリセットテストが JSX を丸ごとコピペしていたので workGridElement / rerenderWorkGrid ヘルパーへ整理

検証:
- pnpm check（tsc x3 + oxlint + oxfmt）通過
- pnpm test 通過（全体340件 / client 311件）
- ビジュアルテスト: 5 passed / 1 flaky。flaky は work-detail-missing.png（.mle-prv、差分1202px = 0.01）で本変更と無関係。TASK-108（ビジュアルテストのフォント依存を解消する）の既知事象

計測方法の訂正と最終検証結果。

agent-browser の `react renders` プロファイラは祖先コンポーネントを過剰カウントするため使えないことが判明した。決定的な証拠: AddressBar 内のローカル useState（ソートメニュー開閉）を変えるだけの操作で、App / QueryClientProvider / NotificationBell / AxisRowItem が再レンダーされたと記録された。React では子の setState が親を再レンダーすることは原理的にあり得ない。レビュー時の「リファクタ前 480 renders」という数字も同じツール由来なので絶対値は割り引く必要がある（ただし App が atom を購読していたのはコード上の事実なので、方向性の診断は有効）。

代わりに countRender() を各コンポーネント関数の先頭へ仕込む一時計装（window.__rc に積算）でグラウンドトゥルースを取得した。React.StrictMode 有効のため表示値は論理レンダー数の2倍。

計測結果（グリッド表示、fixture 11件）:
| コンポーネント | アイドル5秒 | スライダー3tick | トグル1click | ソートメニュー | 検索1文字 |
|---|---|---|---|---|---|
| App | 0 | 0 | 0 | 0 | 2 |
| TopBar | 0 | 0 | 0 | 0 | 4 |
| LeftNav | 0 | 0 | 0 | 0 | 2 |
| PlayerDock | 0 | 0 | 0 | 0 | 2 |
| AddressBar | 0 | 0 | 0 | 2 | 2 |
| LibraryGridControls | 0 | 6 | 2 | 2 | 2 |
| LibraryView | 0 | 0 | 0 | 0 | 6 |
| AxisColumn | 0 | 0 | 0 | 0 | 6 |
| WorkGrid | 0 | 6 | 6 | 0 | 14 |

- スライダー3tick では LibraryGridControls と WorkGrid のみ（各6 = 論理3回）。祖先は全て0 → AC#4 達成
- ソートメニューは AddressBar とその子の LibraryGridControls のみ（子が親の再レンダーで再実行されるのは正常）
- 検索1文字（陽性対照）では App 配下が広く再レンダーされ、計装が正しく機能していることを確認
- アイドル時の背景ノイズは0

計装は撤去済み（client/src/shared/lib/renderCount.ts も削除）。撤去後に pnpm check / pnpm test 再実行、いずれも通過。

派生して分かったこと（別タスク向けメモ）:
- 検索1文字で TopBar が4カウント（論理2回）。App からの再レンダー + TopBar 自身の draft state 更新で2回になっている。TASK-115 で TopBar を触るときの参考
- 検索1文字で WorkGrid が14カウント（論理7回）。デバウンス・クエリ更新・virtualizer の再計測が重なっている。TASK-117 で調べる価値あり
- 敷き詰めトグル1クリックで WorkGrid が6カウント（論理3回）。justified レイアウト再計算と virtualizer.measure() の往復と思われる。draft-32「原寸グリッドでカバー画像が震える現象」と関連する可能性
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
グリッド表示設定の3つの Jotai atom（libraryTileSizeAtom / libraryViewModeAtom / libraryGridLayoutModeAtom）の購読を App.tsx のルートから、実際に値を使うコンポーネントへ降ろした。

新規 LibraryGridControls に1:1/原寸トグルとサイズスライダーを切り出し、WorkGrid と LibraryView も必要な atom を自身で購読する形にして、App → AddressBar と App → LibraryView → WorkGrid の3段 props ドリルを削除した（AddressBar から7 props、WorkGrid から3 props、LibraryView から4 props が消えた）。React.memo は追加していない（購読位置を下げれば App が再レンダーされないため不要）。

検証: pnpm check と pnpm test 通過。ビジュアルテスト 5 passed / 1 flaky（本変更と無関係のフォント依存、TASK-108 の既知事象）。ブラウザでの一時計装によるレンダー計測で、スライダー3tick で再レンダーされるのは LibraryGridControls と WorkGrid のみ、App / TopBar / LeftNav / PlayerDock / AxisColumn は0回（AC#4 達成）。陰性対照・陽性対照で計装の妥当性も確認。機能退行なし。Codex のレビューで指摘なし。
<!-- SECTION:FINAL_SUMMARY:END -->
