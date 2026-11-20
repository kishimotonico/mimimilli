---
id: TASK-513.4
title: 要対応タブを5種類の行とその場の操作に作り直す
status: To Do
assignee: []
created_date: '2026-11-20 10:40'
labels:
  - scan
  - ui
dependencies:
  - TASK-513.1
references:
  - 'https://claude.ai/artifact/XvdN9UKvcg9GtL2gixXQ34'
documentation:
  - docs/adr/0039-scan-modal-current-problems-and-explicit-states.md
parent_task_id: TASK-513
priority: high
ordinal: 592000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0039「要対応は保存済みのデータから出す」のクライアント側。今はID重複の行に操作が無く、どちらが登録済みかも分からない（監査H4）。データ不整合は作品IDだけで何の作品か分からず、操作の成功時にトーストが出ない（M9）。列は 種類 / 対象 / 起きていること / 推奨アクション。パスはFilesで開くリンク、作品タイトルは作品詳細を開くリンク。文字の操作ボタンはID重複の未登録側の「別の作品として取り込む」、データ不整合の「読み直す」、行方不明の「登録解除」だけ。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ID重複の行が登録済みの側に作品タイトルと作品IDを出し、未登録の側の行に「別の作品として取り込む」を置く
- [ ] #2 データ不整合の行が作品タイトルを出して「読み直す」でき、行方不明の行が作品タイトルと最後のパスを出して「登録解除」できる。読み取り失敗・アクセス不可にはボタンを置かない
- [ ] #3 操作が成功したら対象名入りのトーストを出して行を消す。読み直しても直らないときはそう知らせて行を残す
- [ ] #4 並びは直すもの（ID重複・読み取り失敗・アクセス不可・データ不整合）が先、行方不明が後。全部片づいたら空の表示だけになる
- [ ] #5 要対応の件数とライブラリのエラーの行方不明・データ不整合の件数が一致することをテストで確かめている
<!-- AC:END -->
