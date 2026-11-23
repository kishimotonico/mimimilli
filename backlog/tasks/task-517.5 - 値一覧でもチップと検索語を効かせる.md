---
id: TASK-517.5
title: 値一覧でもチップと検索語を効かせる
status: Done
assignee: []
created_date: '2026-11-23 12:49'
updated_date: '2026-11-23 16:09'
labels:
  - library
  - client
dependencies:
  - TASK-517.10
parent_task_id: TASK-517
priority: medium
ordinal: 628000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0026 から引き継いだ「値一覧はチップと検索語を効かせない」をやめる。値一覧でタグを足す・検索すると、今のスマートフォルダーの値一覧にそのまま絞り込みがかかり、値と件数が絞り込み後のものになる。操作感はユーザーが実機で確かめ、気になったら戻す（戻す判断はユーザー）。docs/design-system.md:251 付近の「チップ・検索語と独立した入口（ADR-0026）」と requirements-v4.md の値一覧の記述も ADR-0041 に合わせて直す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 値一覧でチップを足すと、同じスマートフォルダーの値一覧のまま、値と件数が絞り込み後になる
- [x] #2 値一覧で検索すると、同じ値一覧のまま検索語が効く
- [x] #3 pnpm test:smoke の値一覧のシナリオが新しい挙動で通る
- [x] #4 チップ追加・検索・値の選択・値一覧へ戻る・「すべて」で探すの遷移関数が folders を受け取らず、値一覧か作品一覧かで分岐しない（補正の normalizeLibraryFolder は対象外）
- [x] #5 値一覧でチップか検索語を付けて「検索を保存」すると、グループ分けと値の並びを保ったまま保存され、開くと同じ値一覧が見える
- [x] #6 パンくずの値のポップオーバーは今のチップと検索語をかけた件数を出し、選んだあとの作品一覧の件数と一致する。サイドバーのクイックオーバーレイは絞り込みなしで出す
- [x] #7 値一覧が絞り込みで0件のとき「すべて」で探す操作が出て、同じチップと検索語のまま「すべて」へ移る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
統括: saveSearch.test.ts の isOverwritable("fav") の確認は saveOffer の確認と同義で重複している（517.10 の常駐レビューの nit）。保存の規則を触るときにどちらか一方にまとめる。

統括: 6bb180d3・14633d26 を統合ブランチへ。常駐レビュー（important 1・nit 4）を反映し再レビューで問題なし。smoke はレビュー担当のフル2回とも 74/74。ユーザーの操作感の確認待ち（http://task-517-5.mimi.localhost:1355/library/by-cv）。戻す判断が出たらこの2コミットを revert する。

2026-11-24 ユーザーの操作感の確認: 続けてよい（戻さない）。あわせて「値の並び」「作品の並び」が分かりにくい、「並び」より「ソート」がよいとの指摘 → 517.11 に起票。
<!-- SECTION:NOTES:END -->
