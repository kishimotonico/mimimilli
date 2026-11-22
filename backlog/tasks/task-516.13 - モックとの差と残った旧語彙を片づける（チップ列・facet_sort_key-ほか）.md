---
id: TASK-516.13
title: モックとの差と残った旧語彙を片づける（チップ列・facet_sort_key ほか）
status: Done
assignee: []
created_date: '2026-11-22 15:25'
updated_date: '2026-11-22 16:15'
labels:
  - library
  - ui
dependencies: []
parent_task_id: TASK-516
priority: high
ordinal: 614000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-516 の最終レビューの指摘と、ユーザー決定（2026-11-23: チップの地を無彩色、AND ラベルと「すべてクリア」を消す）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 チップの地が構想モックどおり無彩色で、チップの間の「AND」ラベルと「すべてクリア」が無い。smoke と単体テストが通る
- [x] #2 値一覧の件数表示が「N 分類」だけで、「件数はライブラリ全体」の注記が無い
- [x] #3 旧ルール編集 UI の CSS（smart-folder-rules.css と index.css の import）が無い
- [x] #4 tags.facet_sort_key が catalog migration で今の語彙の名前に改名され、コードに facet の語が残っていない
- [x] #5 グループ分けの行のクイックオーバーレイ（値の主クリックと追加ボタン）の smoke がある
- [x] #6 履歴エントリーの seed をサーバー契約の範囲で検証し、LibrarySidebar の保存の判定が saveSearch の関数を使う
<!-- AC:END -->
