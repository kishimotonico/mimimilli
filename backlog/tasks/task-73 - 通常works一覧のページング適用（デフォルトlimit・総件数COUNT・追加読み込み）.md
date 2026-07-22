---
id: TASK-73
title: 通常works一覧のページング適用（デフォルトlimit・総件数COUNT・追加読み込み）
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-19 04:26'
updated_date: '2026-07-22 01:12'
labels: []
dependencies:
  - TASK-58
priority: high
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
旧TASK-58の分割2つ目（58B相当、Codexレビュー2026-07-19）。TASK-58（DTO分離）の後に着手。

内容: page/limitのサーバー側デフォルト導入（未指定でも上限適用、limitだけ指定時はpage=1扱い）。ライブラリ総件数は専用COUNT（全件DTOを構築して数えない）。一覧のtotalは「検索・フィルター後・ページング前」の件数で、ライブラリ総数（フィルター非依存）とは用途が異なるため区別する。クライアントは末尾での追加読み込み（ページ蓄積）に対応。ソートは同順位をid等の安定タイブレーカーで安定化。

randomソートの仕様化が必須: server/src/core/worksQuery.ts:118 はリクエストごとにシャッフルするため、ページごとに再シャッフルすると重複・欠落が必ず起こる。「seedをクエリに持ち全ページ同順序」「randomは単一ページのランダムサンプル（次ページなし）」等のいずれかを決めて実装する。

注意（並行ADRとの調整）: real側の検索・ソートのSQL化はTASK-71のADR（検索所有権の決定）を待つ。本タスクはページング契約とインメモリ実装の範囲で完結させる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /works が limit 未指定でも全件返さない（サーバー側デフォルト上限）
- [x] #2 limitのみ指定時も page=1 として動作し、searchWorks({limit:1}) の総件数取得が退行しない（専用COUNTまたは正しいページング指定へ移行）
- [x] #3 1ページ目と2ページ目で重複・欠落がない（安定タイブレーカー）。検索・タグAND/OR・軸・view・全sortでページング前後の集合が一致する
- [x] #4 randomソートのページング仕様が決定・実装・テストされている
- [x] #5 スキャン完了後の新規作品が先頭ページ外でも取得できる
- [x] #6 fixture/real 契約一致、pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
randomソートのページング仕様（AC#4の決定）: seed方式を採用。初回（seed未指定）はサーバーがseedを発行しWorksPage.seedで返す。clientはそのseedをpageParam経由で次ページ以降のリクエストに引き継ぐ。同一seedではstableRandomSortKey(seed, id)の安定順序が保たれ、ページ間の重複・欠落が起きない。「単一ページのランダムサンプル」案は追加読み込みと両立しないため却下。総件数取得（searchWorks({limit:1})）はroutesでpage=1が入るため正しいページング指定として退行しない（専用COUNT化は不要と判断）。

client実装の一部はimplementサブエージェント（kimi-k2.7-code）に委譲。監督側でdiffレビューと pnpm check/test の再実行で検証済み。今後は動作確認・検証もサブエージェントへ委譲する運用（依頼者指示 2026-07-22）。
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude-main
created: 2026-07-19 05:08
---
調整(ADR-0008): API契約・client側・core実装の変更は継続OK。real側のSQLページング実装はTASK-78(DB分離)→TASK-79(SQL移行)に統合するので旧DDL上に実装しないこと。
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
GET /worksにサーバー側デフォルトページング（page=1, limit=200=WORKS_DEFAULT_PAGE_SIZE）を適用。clientはuseInfiniteQueryのページ蓄積+LoadMoreボタン（グリッド/リスト末尾）。randomソートはseed方式でclientがpageParam経由で次ページへ引き継ぐ。テスト: server側デフォルト適用・ページ連結一致・random seed（7件）、core全sort/フィルタのページ連結一致（2件）、clientページ蓄積・seed伝播・LoadMore（7件）。client実装の一部はimplementサブエージェント（kimi-k2.7-code）へ委譲し監督側でレビュー・再検証。pnpm check・pnpm test(server207/client280)すべてパス
<!-- SECTION:FINAL_SUMMARY:END -->
