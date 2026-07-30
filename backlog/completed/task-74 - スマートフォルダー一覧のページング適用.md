---
id: TASK-74
title: スマートフォルダー一覧のページング適用
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-19 04:26'
updated_date: '2026-07-22 01:27'
labels: []
dependencies: []
priority: high
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
旧TASK-58の分割3つ目（58C相当、Codexレビュー2026-07-19）。routes/smartFolders.ts:42 は現状ページング契約がなく全件返却。evalSmartFolder() の戻り値をページエンベロープ化し、fixture/real両方の契約を変更、クライアントは追加読み込みに対応する。totalはページング前の評価結果件数。スマートフォルダー固有のsortは維持。ルート・アダプタメソッド・React Query keyが通常一覧と別系統のため独立タスクとして実施できる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 スマートフォルダーAPIがページングエンベロープ（items/total）+ page/limit（サーバーデフォルトあり）で応答する
- [x] #2 クライアントのスマートフォルダー表示が追加読み込みで全件に到達できる
- [x] #3 スマートフォルダー固有のソート順が維持される
- [x] #4 fixture/real 契約一致、pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. shared: worksPageSchemaをGET /smart-folders/:id/worksでも共有（workSummaryListSchema削除）、クエリはworksQuerySchema.pick({page,limit,seed}) 2. routes/smartFolders.tsでデフォルト補完（page=1, limit=WORKS_DEFAULT_PAGE_SIZE） 3. core/smartFolder.tsのevalSmartFolderを(folder, works, query)=>WorksPageに変更（ソートはfolder.sortでseed対応、totalはページング前件数） 4. fixture/real両アダプタのシグネチャ追随 5. client: api.ts evalSmartFolder、smartWorksQueryをuseInfiniteQuery化、works/hasNextPage/worksTotal等をsmartAxis対応、SmartFolderView件数をtotalベースに 6. 既存テスト修正（smartFolder.test.ts/app.test.ts/api.test.tsの.items参照化） 7. 新規テスト: デフォルト適用・ページ連結・random seed引継ぎ・total・固有sort維持・clientページ蓄積 8. pnpm check + pnpm test
<!-- SECTION:PLAN:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude-main
created: 2026-07-19 05:08
---
調整(ADR-0008): TASK-73と同様。real側SQL実装はTASK-79に統合。
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
GET /smart-folders/:id/worksをページングエンベロープ（worksPageSchema共有）+ page/limit/seed（デフォルト補完あり）に変更。core evalSmartFolderは(folder, works, query)=>WorksPageでfolder.sort維持・randomはseed発行/継承。clientはsmartWorksQueryをuseInfiniteQuery化しLoadMoreで追加読み込み、SmartFolderView件数をtotalベースに。実装はimplementサブエージェント（kimi-k2.7-code）に委譲、監督側でdiffレビュー+pnpm check/test再実行で検証。テストserver+7件/client+3件。pnpm check・pnpm test(server214/client283)すべてパス
<!-- SECTION:FINAL_SUMMARY:END -->
