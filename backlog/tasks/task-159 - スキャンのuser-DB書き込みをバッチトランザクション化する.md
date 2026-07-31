---
id: TASK-159
title: スキャンのuser DB書き込みをバッチトランザクション化する
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 17:54'
updated_date: '2026-07-30 18:54'
labels: []
dependencies: []
priority: medium
ordinal: 169000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server/src/adapters/real/scanner.ts:309付近の500作品ごとのtransactionはcatalog接続のみで、内部のupsertWork()が別のuser接続へ書くため、初回3万件スキャンではuser DB側が作品単位のautocommitになる（fsync多発）。user側にもバッチトランザクションを導入する。2026-07-31調査第2波・Codexレビュー追加発見。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 スキャンのuser DB書き込みがcatalogと同様のバッチ単位トランザクションで行われる
- [x] #2 スキャン中断・失敗時の整合性の扱い（どこまで巻き戻るか）が変更前と同等以上で、テストで確認されている
- [x] #3 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. スキャンのuser DB書き込みをcatalogと同じバッチ単位トランザクションへ
2. 中断・失敗時の整合性テスト
実装Cursor委譲
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
調査結果: user側は作品単位autocommitだった（仮説どおり）。Codexレビュー重大指摘2件（ネスト構造のコミット順逆転でopenDb拒否の回復不能状態・catalogバッチ中のuserロック長期保持）を受け、ネスト案を廃止しuser先コミット→catalog後の逐次2トランザクションへ。upsertWorkをuser/catalog書き込みに分離。孤児収束テスト（openDb再オープン成功→再スキャン収束）を追加。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
UpsertBatch.flushをuserバッチコミット→catalogバッチの逐次2トランザクションに変更（fsync多発の解消+通常操作のロック競合回避）。upsertWorkをupsertWorkUserState/upsertWorkCatalogへ分離。server 365テスト・pnpm check通過。実装Cursor委譲、Codexレビュー2件対応。
<!-- SECTION:FINAL_SUMMARY:END -->
