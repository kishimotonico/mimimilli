---
id: TASK-159
title: スキャンのuser DB書き込みをバッチトランザクション化する
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-30 17:54'
updated_date: '2026-07-30 18:44'
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
- [ ] #1 スキャンのuser DB書き込みがcatalogと同様のバッチ単位トランザクションで行われる
- [ ] #2 スキャン中断・失敗時の整合性の扱い（どこまで巻き戻るか）が変更前と同等以上で、テストで確認されている
- [ ] #3 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. スキャンのuser DB書き込みをcatalogと同じバッチ単位トランザクションへ
2. 中断・失敗時の整合性テスト
実装Cursor委譲
<!-- SECTION:PLAN:END -->
