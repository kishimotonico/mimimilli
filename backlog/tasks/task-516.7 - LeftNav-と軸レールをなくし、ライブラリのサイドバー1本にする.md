---
id: TASK-516.7
title: LeftNav と軸レールをなくし、ライブラリのサイドバー1本にする
status: To Do
assignee: []
created_date: '2026-11-21 20:24'
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
- [ ] #1 LeftNav.tsx と AxisColumn.tsx がなくなり、ライブラリ・作品詳細の左にサイドバー1本が出る
- [ ] #2 件数バッジが ADR-0040 の対象だけに出て、エラーの行がデータ不整合だけ残っている間も出続ける
- [ ] #3 アドレスバー左端のボタンと Ctrl+B でサイドバーを隠す・出すでき、状態が再読み込み後も残り、作品詳細でも同じ状態になる
- [ ] #4 トップバーのファイルボタンで全画面のカラム表示に移り、ファイルボタン・ライブラリへ戻る・ブラウザの戻るでライブラリの状態（スマートフォルダー・チップ・検索語・今の並び）のまま戻る
- [ ] #5 グループ分けの行のクイックオーバーレイで、値の主クリックがその値の一覧へ、追加ボタンが ADR-0041 の行き先へチップを足す
- [ ] #6 docs/design-system.md のナビゲーションとライブラリの節が実装に合っている
- [ ] #7 pnpm test:smoke が通る
<!-- AC:END -->
