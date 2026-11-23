---
id: TASK-517.7
title: 画面の文言と語彙をそろえる
status: To Do
assignee: []
created_date: '2026-11-23 12:50'
updated_date: '2026-11-23 16:09'
labels:
  - library
  - client
  - docs
dependencies:
  - TASK-517.11
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
- [ ] #1 値一覧の件数が「{N} 件の値」、空のとき「値がありません」と出る
- [ ] #2 値一覧の値の選択に修飾キーを渡す配線と、ADR-0041 と逆のコメントが無い
- [ ] #3 「エラービュー」の名前（ErrorViewBulkUnregisterBanner・isErrorView・CSS）が今の語彙に置き換わっている
- [ ] #4 docs/design-system.md のライブラリの段落がライブラリの節にあり、方針の正が ADR-0041 を指している
- [ ] #5 編集のダイアログで名前が空のとき保存できないことをテストが確かめる
- [ ] #6 トースト・空状態・サーバーのエラー文言に「スマートフォルダー」が出ず、行の名前と動詞で書かれている（517.2・517.3 で書いた文言を含め、rg で残りが無い）
- [ ] #7 経緯を書いたコメント、消したUIが無いことだけを確かめるテスト、自ファイルでしか使わない export が無い
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
517.10 で済んだもの（統括）: 自ファイルだけの export 5つ（SmartFolderRowFields・GroupPredicate・conditionKey・normalizeCondition・MAX_WITHIN_DAYS）を外し、bench の旧「ルール」の語彙（smartFolderNoRulesId・smartFolderWithRulesId）を改名した。UnreadableFolderRow の改名は 517.7 に残る（review-517-mid.md の6節）。
<!-- SECTION:NOTES:END -->
