---
id: TASK-260
title: serverのデッドコードを一括削除する
status: Done
assignee: []
created_date: '2026-08-08 21:16'
updated_date: '2026-08-09 00:56'
labels: []
dependencies: []
priority: medium
ordinal: 270000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出した確実なデッドコード。
- server/src/adapters/real/dlsite.ts:266-276 downloadCover（本番未使用、cachedCoverに置換済み）
- 同 dlsite.ts:142-184 fetchDlsiteInfo（テストのみ使用。fetchDlsiteHtml+parseDlsiteHtmlと三重化。テストは分割APIへ寄せる）
- server/src/adapters/real/dlsiteScheduler.ts:188-191 schedule()（テストのみ使用）
- server/src/adapters/real/thumbnailCache.ts:242-258 module singleton getOrCreateThumbnail（本番はThumbnailCacheインスタンス。テストも寄せる）
- server/src/adapters/real/db.ts:85,194-202 migratableVersions 引数（常に[]渡しで分岐到達不能）
- server/tests/real/rejection_chain.test.ts（コメントのみの空スタブ）
- shared/src/api.ts:137 旧API統合の経緯コメント（Git履歴に任せる）
countByStatus のSQL化はTASK-269（workRepo分割）へ移管した（同一巨大ファイルを触るため）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 上記デッドコードが削除され、依存テストは現行APIへ寄せられていること
- [x] #2 変更範囲のserverテストが通ること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
migratableVersions は全履歴で常に [] が渡されており、削除後の条件式と等価であることをレビュー担当が git log -p で確認済み（挙動変更なし）。fetchDlsiteInfo のテストは adapter 経由の dlsiteFetch へ寄せ、404/通信エラーの分類検証を維持。thumbnailCache のテストは ThumbnailCache インスタンス経由へ統一し検証内容は維持。検証: pnpm check 成功、server 525 pass / 0 fail。副作用レビュー指摘なし。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
downloadCover・fetchDlsiteInfo・dlsiteScheduler.schedule・thumbnailCache の module singleton・db.ts の migratableVersions 引数・空スタブテスト・shared/src/api.ts の経緯コメントを削除。依存テストは現行APIへ寄せた。countByStatus の SQL 化は TASK-269 へ移管。pnpm check と server 525 テストで検証。
<!-- SECTION:FINAL_SUMMARY:END -->
