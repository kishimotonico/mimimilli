---
id: DRAFT-25
title: 検索・集計のSQL移行（ADR-0004見直し・ハイブリッド方針）
status: Draft
assignee: []
created_date: '2026-07-19 02:03'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
現行のADR-0004は「全件インメモリ→core/の純粋関数」で検索・集計を行う設計だが、ADR自身が「全件処理はスケールしなくなったら見直す」と明記している。30,000作品を正式ターゲットにするなら見直し時期。

2026-07-19のパフォーマンス調査で推奨された方針: routes層は薄いまま、fixtureは既存純粋関数を使い続け、realアダプタのみ検索・ソート・ページング・ファセット集計（GROUP BY）・スマートフォルダーの候補抽出をSQLへ移す。純粋関数は仕様の参照実装として残し、同じfixtureをSQLiteへ投入してSQL結果と突き合わせる契約テストで一致を担保。SQL化しにくい条件はSQLで候補を絞ってから純粋関数で最終評価するハイブリッド。日本語部分一致検索のFTS化はtokenizer/照合の仕様一致テストが必須。SQLインデックスはクエリ設計とEXPLAIN QUERY PLANを決めてから追加（現状はstatus等の複合インデックスなし）。axisFacets/tagPrefixCandidatesの毎回全件集計もこの移行で解消する。

TASK-57/58（N+1解消・ページング）完了後に、実測を見て要否と範囲を判断する。着手時はまず「要件とADR改定案を決める」タスクを切る。
<!-- SECTION:DESCRIPTION:END -->
