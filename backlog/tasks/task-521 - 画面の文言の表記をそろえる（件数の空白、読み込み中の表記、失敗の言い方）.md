---
id: TASK-521
title: 画面の文言の表記をそろえる（件数の空白、読み込み中の表記、失敗の言い方）
status: To Do
assignee: []
created_date: '2026-11-23 21:30'
labels:
  - client
  - server
dependencies: []
priority: low
ordinal: 640000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-517 の最終レビューの文言の調査（Fable の final-sweep-wording.md の「不統一」）で見つかった、アプリ全体の表記の揺れを直す。挙動は変えない。件数の空白は、517.7 で値一覧を作品一覧に合わせて「CV 3 件」（空白あり）にした経緯があるので、どちらにそろえるかをこのタスクで決める。画面に内部の語を出さない・ソートは「ソート」と呼ぶ方針（ADR-0041）は保つ。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 件数の表記（数字と「件」の間の空白）がアプリ全体で1種類にそろっている
- [ ] #2 「読み込み中…」の三点リーダーが1種類にそろっている
- [ ] #3 操作の失敗の文言が「〜できませんでした」、取得の失敗が「〜の取得に失敗しました」にそろい、トーストは句点なしになっている
- [ ] #4 server の 400 の文言の「要求が不正です」が、ほかの口と同じ言い方にそろっている
<!-- AC:END -->
