---
id: TASK-517.7
title: 画面の文言と語彙をそろえる
status: Done
assignee: []
created_date: '2026-11-23 12:50'
updated_date: '2026-11-23 18:44'
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
- [x] #1 値一覧の値の選択に修飾キーを渡す配線と、ADR-0041 と逆のコメントが無い
- [x] #2 「エラービュー」の名前（ErrorViewBulkUnregisterBanner・isErrorView・CSS）が今の語彙に置き換わっている
- [x] #3 docs/design-system.md のライブラリの段落がライブラリの節にあり、方針の正が ADR-0041 を指している
- [x] #4 編集のダイアログで名前が空のとき保存できないことをテストが確かめる
- [x] #5 トースト・空状態・サーバーのエラー文言に「スマートフォルダー」が出ず、行の名前と動詞で書かれている（517.2・517.3 で書いた文言を含め、rg で残りが無い）
- [x] #6 経緯を書いたコメント、消したUIが無いことだけを確かめるテスト、自ファイルでしか使わない export が無い
- [x] #7 値一覧の件数・空のとき・名前で絞る欄が、内部の語「値」「分類」「項目」を出さずグループ分けの名前で書かれている（例: 「CV 12件」「CVがありません」「CVを絞り込み」）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
517.10 で済んだもの（統括）: 自ファイルだけの export 5つ（SmartFolderRowFields・GroupPredicate・conditionKey・normalizeCondition・MAX_WITHIN_DAYS）を外し、bench の旧「ルール」の語彙（smartFolderNoRulesId・smartFolderWithRulesId）を改名した。UnreadableFolderRow の改名は 517.7 に残る（review-517-mid.md の6節）。

統括 2026-11-24: AC1 を書き換えた。もとは「{N} 件の値」「値がありません」だったが、ユーザーの指摘（「値の並び」が分かりにくい、内部の語を画面に出さない）に合わせ、517.11 と同じくグループ分けの名前で呼ぶ。

057d63df・19764a65・3b91beaf・5b76d969。画面から内部の語（値・分類・項目・スマートフォルダー）を外し、グループ分けの名前と行の名前で書く（「CV 3 件」「CVがありません」「CVを絞り込み」「「〇〇」を保存できませんでした」）。エラービュー等を改名、修飾キーの配線を削除、design-system.md の段落を移動。常駐レビューで 404・409 の生 ID のトースト、「既定の並び」の残り、409 の root_reconfiguring を名前入りの文言で隠す件を直した。
<!-- SECTION:NOTES:END -->
