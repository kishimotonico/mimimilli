---
id: TASK-517.13
title: Codex のレビューの指摘を直す（再追加の古い一覧、件数の競合、再取得の 500、position の検証）
status: Done
assignee: []
created_date: '2026-11-23 19:36'
updated_date: '2026-11-23 20:08'
labels:
  - library
  - client
  - server
dependencies: []
parent_task_id: TASK-517
priority: high
ordinal: 638000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codex（mimi2）の TASK-517 レビュー（統括の scratchpad の codex-review-517.md、important 1〜4）を直す。各指摘は、直す前にまず失敗するテストで再現してから直す（再現できなければ直さずに報告）。nit 5（修復コマンドの DB パスの $ 展開）は対応しない: データの置き場所に $ を含めるのは極端で、Linux と Windows の両方で安全に引用する仕組みが割に合わない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 既定の行を削除して「既定から追加」で同じ ID を戻したとき（条件が変わった往復）、作品一覧と値一覧が新しい条件で取り直されることをテストが確かめる
- [x] #2 件数の初回取得の途中でお気に入り・再生・登録解除をしたとき、件数が変更後の値で取り直されることをテストが確かめる
- [x] #3 定義の一覧の再取得が 500（読めない行）で失敗したとき、前のデータが残っていてもサーバーの直し方の案内と再試行が画面に出ることをテストが確かめる
- [x] #4 position が負など保存できない形の行を、サーバーが読めない行（500 と直し方）として扱い、smartFolderStorage.test.ts の表で確かめる
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
e468740f・fd54f348。Codex の important 1〜4 をそれぞれ失敗するテストで再現してから直した。常駐レビューで、一時的な通信失敗で一覧がエラー画面に変わる件（ApiTransportError は前のデータを残す）と、invalidateFresh が取り直されない取得まで取り消す件（isActive のものだけ取り消す）を直した。nit 5（DB パスの $ 展開）は対応なし。

追加（統括）: Codex の再確認で残った2件（再追加の古い一覧は同じ ID のキャッシュを settle 前に remove、件数の取得は signal で中断）を直し、常駐レビューで同じ経路が件数以外にもあると分かったので「queryFn は signal を API まで渡す」をアプリ全体の規則にした（ADR-0028。取得の寿命を手で管理するクエリは除く）。文字列での検査は置かない。
<!-- SECTION:NOTES:END -->
