---
id: TASK-136
title: API契約を締める（worksQueryのinput/output型分離・更新系スキーマの空payload拒否）
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 12:31'
updated_date: '2026-07-30 16:31'
labels: []
dependencies: []
priority: low
ordinal: 146000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
shared契約の細部の締め直し2点（検証済み）。

1. input/output型の未分離: shared/src/api.ts:13-26 の worksQuerySchema は q/tags/tagOp/sort に .default() を持つため、z.infer（output型）では省略可能なはずのHTTP入力が必須型になる。その結果 client/src/features/library/api.ts:31-42 の WorksQueryParams が z.input 相当を手書き再定義している（フィールド構成は完全一致の重複と検証済み）。z.input<>/z.output<> を別名でsharedから公開し、clientは input 型・server adapterは output 型を使う形に統一して手書き型を削除する
2. 空payloadの成功扱い: workPatchSchema(shared/src/api.ts:101-106)・tagPrefixUpdateSchema(shared/src/tagPrefix.ts:55-61)・smartFolderUpdateSchema(shared/src/library.ts:95-100)は全フィールドoptionalで {} が有効、routes はそのまま no-op 200 を返す。最低1フィールドを要求する refine を追加して意図不明な空更新を契約として拒否する
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 sharedがworksQueryのinput/output型を公開し、clientの手書きWorksQueryParamsが削除されている
- [x] #2 更新系3スキーマが空payloadを400で拒否し、テストがある
- [x] #3 pnpm check・pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. worksQueryのz.input/z.output型を別名公開しclientの手書き型を削除
2. 更新系3スキーマに最低1フィールドのrefine追加+テスト
3. pnpm check + pnpm test
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor(composer-2.5)で実装。WorksQueryInput(z.input)/WorksQuery(z.output)を公開しclientの手書き型を削除（互換aliasは@deprecated付きで一時残置）。更新系3スキーマへ最低1フィールドrefine追加、updatePayloadContract.test.tsで400を固定。全体check+test:server 353件+test:client 392件通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
worksQueryのinput/output型を分離してclient手書き型を廃止し、更新系スキーマの空payloadを契約として拒否。
<!-- SECTION:FINAL_SUMMARY:END -->
