---
id: TASK-303
title: 未再生(unplayed)ビューを削除する
status: Done
assignee:
  - '@claude-sonnet'
created_date: '2026-08-11 09:51'
updated_date: '2026-08-11 10:12'
labels: []
dependencies: []
ordinal: 313000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DRAFT-52(ビュー軸再編)より。未再生ビューは使われていないため削除する。変更箇所: shared/src/library.ts:34のviewIdSchemaから"unplayed"を除去、server/src/core/worksQuery.ts:144-145のfilterByView分岐、server/src/adapters/real/workQuerySql.ts:198-199のviewConditions分岐、client/src/entities/library/axisDefinitions.tsのVIEW_AXIS_IDS/ラベル/アイコン。shared/src/tagPrefix.tsの予約語リスト(RESERVED_AXIS_IDS)からもunplayedを外す。テスト更新: server/tests/worksQuery.test.ts、server/tests/real/worksQueryContract.test.ts、client/tests/unit/axisDefinitions.test.ts。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 軸レールから未再生ビューが消え、view=unplayed指定はAPIバリデーションで弾かれる
- [x] #2 予約語リストからunplayedが外れ、同名のタグprefixを登録できる
- [x] #3 関連テストが更新され、変更範囲のテストが通る
<!-- AC:END -->
