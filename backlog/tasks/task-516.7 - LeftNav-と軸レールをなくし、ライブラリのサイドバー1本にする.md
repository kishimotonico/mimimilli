---
id: TASK-516.7
title: LeftNav と軸レールをなくし、ライブラリのサイドバー1本にする
status: Done
assignee: []
created_date: '2026-11-21 20:24'
updated_date: '2026-11-22 11:16'
labels:
  - library
  - ui
dependencies:
  - TASK-516.6
references:
  - 'https://claude.ai/artifact/7a3AkWuZisApFV6SZAnkg4'
documentation:
  - docs/adr/0041-library-sidebar-shell-navigation.md
parent_task_id: TASK-516
priority: high
ordinal: 608000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0041「全体の構成」「サイドバー」の実装。LeftNav と AxisColumn を撤去し、見出し「ライブラリ」のサイドバー1本にする（総称は画面に出さない）。件数（条件が空のもの・グループ分けのものには出さない）、エラーの行の隠し方（hasError の作品数とデータ不整合の件数の両方が0のときだけ隠す、開いている間は残す、取得中・失敗は0件扱いしない）、隠す・出す（アドレスバー左端のボタンと Ctrl+B、端末に保存、画面幅で自動切替しない）、作品詳細でも出す（選択中の行を押すと元の一覧へ戻る）、最下部の統計、ファイルをトップバーの道具に（全画面のカラム表示、戻る）、グループ分けの行のクイックオーバーレイ。見た目の正は docs/design-system.md と実装、参考は構想モック。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 LeftNav.tsx と AxisColumn.tsx がなくなり、ライブラリ・作品詳細の左にサイドバー1本が出る
- [x] #2 件数バッジが ADR-0040 の対象だけに出て、エラーの行がデータ不整合だけ残っている間も出続ける
- [x] #3 アドレスバー左端のボタンと Ctrl+B でサイドバーを隠す・出すでき、状態が再読み込み後も残り、作品詳細でも同じ状態になる
- [x] #4 トップバーのファイルボタンで全画面のカラム表示に移り、ファイルボタン・ライブラリへ戻る・ブラウザの戻るでライブラリの状態（スマートフォルダー・チップ・検索語・今の並び）のまま戻る
- [x] #5 グループ分けの行のクイックオーバーレイで、値の主クリックがその値の一覧へ、追加ボタンが ADR-0041 の行き先へチップを足す
- [x] #6 docs/design-system.md のナビゲーションとライブラリの節が実装に合っている
- [x] #7 pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
516.6 からの引き継ぎ: docs/design-system.md の「値の選択操作」節は 516.6 で存在しない参照（valueSelectionContract・GET /axes）だけを外した。節全体を新しい挙動（グループの値・パンくずの兄弟値・クイックオーバーレイ・行き先表）で書き直すのはこの段。client に残る axis/facet の語彙（AxisFacetItem・useAxisFacetsQuery・facetItems・AxisColumn 由来の名前）は、軸レールを撤去するこの段で整理するか、分けるかを着手時に統括が決める。

実装担当(516.7): LeftNav・AxisColumn・左ナビ/軸レールCSS撤去、LibrarySidebar(features/library)をシェルのsidebarスロットへ。AxisQuickOverlay→GroupQuickOverlay。再生中の層は516.9、見出しの＋/編集は516.8。nowPlaying系smokeはLeftNavの「再生中」ボタンが消えたため、ポップアップの「再生中タブを表示」経由(support.ts openNowPlayingFromBar)に変更(ADR-0041に基づく入口の変更)。nowPlaying mode中もサイドバーを出している(層の実装まで出口を残すため、516.9で隠れる層に置き換わる)。
<!-- SECTION:NOTES:END -->
