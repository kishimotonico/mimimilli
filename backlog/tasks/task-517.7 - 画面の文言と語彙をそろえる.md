---
id: TASK-517.7
title: 画面の文言と語彙をそろえる
status: To Do
assignee: []
created_date: '2026-11-23 12:50'
labels:
  - library
  - client
  - docs
dependencies: []
parent_task_id: TASK-517
priority: low
ordinal: 630000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
画面に総称「スマートフォルダー」を出さない決定（ADR-0040・0041、ユーザー決定 2026-11-23 の A 案）に、トースト・エラー文言を合わせる。軸・ビューの時代の語彙と経緯コメントを消す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 トースト・空状態・サーバーのエラー文言に「スマートフォルダー」が出ず、行の名前と動詞で書かれている
- [ ] #2 値一覧の件数が「{N} 件の値」、空のとき「値がありません」と出る
- [ ] #3 値一覧の値の選択に修飾キーを渡す配線と、ADR-0041 と逆のコメントが無い
- [ ] #4 「エラービュー」の名前（ErrorViewBulkUnregisterBanner・isErrorView・CSS）が今の語彙に置き換わっている
- [ ] #5 経緯を書いたコメントと、消したUIが無いことだけを確かめるテストが無い
- [ ] #6 docs/design-system.md のライブラリの段落がライブラリの節にあり、方針の正が ADR-0041 を指している
- [ ] #7 編集のダイアログで名前が空のとき保存できないことをテストが確かめる
<!-- AC:END -->
