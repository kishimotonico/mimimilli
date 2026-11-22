---
id: TASK-516.19
title: スマートフォルダーに値一覧の並びを持たせる（shared・server）
status: Done
assignee: []
created_date: '2026-11-22 21:25'
updated_date: '2026-11-22 21:49'
labels:
  - library
dependencies: []
parent_task_id: TASK-516
priority: high
ordinal: 620000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
グループ分けを持つスマートフォルダーで、値一覧の並び（group_sort）をフォルダーに保存する。作品一覧の並び（sort）は今のまま。ユーザー決定（2026-11-23）: 設計案C を採用し、TASK-516 の master マージ前に行う。設計メモ: /tmp/claude-1000/-home-nico-projects-mimikago/group-sort-design.md（実装担当は着手時に内容を実装メモへ要約して残す）。階層の深いタグ（hoge/fuga/piyo/aaa）もあり得るので、2段の前提を新たに埋め込まない。階層への対応を足すと重くなるなら今の扱いのまま進め、現状の挙動を報告する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 smart_folders に値一覧の並び（group_sort）があり、グループ分けを持つときだけ必須で継承が無い。0007 の migration を作り直し、開発中の DB 向けの手動コマンドが ADR-0040 にある
- [x] #2 値の並びは8種（件数・名前（読み）・総時間の各昇順降順、最近追加した順、最近再生した順）で、値一覧の集計が値ごとの最近追加・最近再生と読みを返す
- [x] #3 テンプレートの既定: 追加年別は名前の降順、ほかのグループ分けは件数の多い順、シリーズ別の作品の並びはタイトルの昇順
- [x] #4 PUT /smart-folders/:id/group-sort で値の並びだけを保存でき、権限と検証はサーバーで強制される
- [x] #5 core と SQL の値一覧の並びが fixture・real の両アダプタで一致することを契約テストで縛っている
- [x] #6 ADR-0040 の該当箇所（グループ分け・並び順・テンプレート表・DDL・HTTP の契約）が実装に合っている
<!-- AC:END -->













## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
設計案C採用(ユーザー承認)。要点: smart_folders.group_sort(groupBy有のみ必須/無はnull/継承なし)。値の並び8種(count-desc/asc,name-asc/desc(sort_key),duration-desc/asc,added-desc,last-played)。groupValuesは値ごとlastAddedAt/lastPlayedAt/sortKeyを返しサーバーで並べる。既定: 追加年=name-desc、他=count-desc、シリーズ別の作品sort=title-asc。PUT /:id/group-sort。0007を作り直し、手動ALTER/UPDATEはADR-0040移行へ。階層深いタグの現状はテストで確認し報告。
<!-- SECTION:NOTES:END -->
