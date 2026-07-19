---
id: TASK-79
title: real検索のSQL移行（ATTACH JOIN・日本語ソートキー・core同値性契約テスト）
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 05:07'
updated_date: '2026-07-19 07:56'
labels: []
dependencies:
  - TASK-78
modified_files:
  - shared/src/api.ts
  - client/src/features/library/api.ts
  - client/tests/unit/api.test.ts
  - server/src/core/japaneseSortKey.ts
  - server/src/core/worksQuery.ts
  - server/src/core/axisFacets.ts
  - server/src/core/smartFolder.ts
  - server/src/adapters/real/catalogSchema.ts
  - server/src/adapters/real/db.ts
  - server/src/adapters/real/index.ts
  - server/src/adapters/real/workRepo.ts
  - server/drizzle/catalog/0001_easy_tana_nile.sql
  - server/drizzle/catalog/0002_bored_valkyrie.sql
  - server/drizzle/catalog/meta/_journal.json
  - server/drizzle/catalog/meta/0001_snapshot.json
  - server/drizzle/catalog/meta/0002_snapshot.json
  - server/tests/japaneseSortKey.test.ts
  - server/tests/worksQuery.test.ts
  - server/tests/tagPrefixes.test.ts
  - server/tests/app.test.ts
  - server/tests/real/worksQueryContract.test.ts
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0008の実装第2弾（DRAFT-25の実現）。TASK-78のDB分離が前提。

やること:
- realアダプタの作品一覧・検索・ソート・件数・ページングを、全件メモリ処理（core/worksQuery経由）からATTACH JOINのSQLへ移行。coreの純粋関数は仕様の正本・fixture実装・参照実装として残す（ADR-0008「検索・ソート・ページングの所有権」参照）
- 日本語向け事前計算ソートキー: core所有の関数（NFKC+カタカナ→ひらがな折りたたみ+lowercase）で生成し、catalogの派生キャッシュ列に保存。SQLはそのキーのバイト順で並べる。localeCompare("ja")は廃止（ADR-0008修正版参照）
- 全ソートにwork_id ASCの最終タイブレーカー。randomソートはseed契約（ADR-0008参照）
- core純粋関数とSQLの同値性を契約テストで保証（同一fixtureを両方に投入して順序付きID列・total・ファセットを比較）
- TASK-73/74（ページングAPI適用）のreal側実装はこのタスクに統合する（契約・client側は各タスクで先行可）

性能目標: 数千〜30,000件規模で一覧APIがページングで応答できること（TASK-57のN+1解消もSQL化で同時に解消される）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 realの一覧・検索・ソート・ページングがSQLで実行され、全件メモリロードが解消されている
- [x] #2 日本語ソートキーの派生列で並び、coreとSQLの同値性契約テストが通る
- [x] #3 bookmarked・lastPlayedAt・addedAt等のuser条件を含む絞り込み・ソート・ページングが正確
- [x] #4 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. スマートフォルダーのrandom評価へリクエスト単位のseedを供給し、route回帰テストを追加する。
2. clientのWorksQueryParamsとURLシリアライザーへseedを配線し、同じseedによる2ページ取得で重複・欠落がないAPIテストを追加する。
3. realのCOUNTとページSELECTを同一SQLite読み取りトランザクションで実行する。
4. tagsへ値部分専用のfacet_sort_keyを追加して保存し、結合文字prefixを含むcore/SQLファセット同値性テストを追加する。
5. pnpm check / pnpm testを通し、レビュー修正内容をBacklogへ記録する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装判断:
- NFKC→カタカナからひらがなへの折りたたみ→Unicode lowercaseをcoreの共通キーとし、SQLite BINARYと同じUTF-8バイト順を参照実装でも使う。
- randomは任意seedをquery/responseへ追加。未指定時は発行し、hex(work_id)をseed位置で回転した決定的キーとwork_id ASCでSQL/coreを一致させる。
- queryWorksはATTACH JOINの共通WHEREからCOUNTとORDER BY/LIMIT/OFFSETを実行し、タグとDLsite状態はページ内作品だけを一括復元。軸ファセットはSQL GROUP BYで集計。
- 現行WorksQueryにresume条件は存在しないため新しい絞り込み契約は追加せず、既存のbookmarked/lastPlayedAt/addedAt/status条件をSQL化した。

検証:
- pnpm check 成功。
- pnpm test 成功（server 166件、client 243件）。
- 同値性契約テストは固定例と120生成クエリで全SortId、タグAND/OR、軸、view、null・同順位・ページ境界、日本語正規化を比較。ファセットは6軸を比較。
- 5,000件、title-asc、page=100、limit=30の中央値: SQL 2.06ms（15回）、旧全件ロード相当 232.28ms（7回）、112.9倍。idx_works_title_sort_keyのcovering index利用を確認。

詳細レビューのP1 2件・P2 2件に対応するため再開。

レビュー修正:
- smart folderのrandom評価でリクエスト単位のseedを発行し、GET /smart-folders/:id/worksの回帰テストを追加。
- client WorksQueryParamsとURLシリアライザーへseedを追加し、レスポンスseedを2ページ目へ再送してIDの重複・欠落がないAPIテストを追加。現行useLibraryQueriesにはページ状態がないため追加配線は不要。
- queryWorksのCOUNT、ページSELECT、ページ内タグ復元を同一SQLite読み取りトランザクション内で実行。
- tags.facet_sort_keyを値部分から直接生成。NFKCで文字数が変わる結合文字prefix（e+結合アクセント）のファセット同値性と期待順を契約テストへ追加。catalog schema versionは3。

再検証:
- pnpm check 成功。
- pnpm test 成功（server 167件、client 244件）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
real検索SQL移行に加え、レビュー指摘4件を修正した。smart folder randomのseed供給、clientのseed再送、COUNT/SELECTの同一スナップショット、値専用ファセットソートキーを実装し、回帰・同値性テストと全体check/testで確認した。
<!-- SECTION:FINAL_SUMMARY:END -->
