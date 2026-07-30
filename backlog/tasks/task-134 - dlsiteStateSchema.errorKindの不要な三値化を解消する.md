---
id: TASK-134
title: dlsiteStateSchema.errorKindの不要な三値化を解消する
status: To Do
assignee: []
created_date: '2026-07-30 12:29'
labels: []
dependencies: []
priority: low
ordinal: 144000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
shared/src/dlsite.ts:15 の errorKind が dlsiteFetchErrorKindSchema.nullable().optional() で、型が DlsiteFetchErrorKind | null | undefined の三値になっている。全書き込み経路（emptyDlsiteState、fixture/index.ts:694,751、real/index.ts:877,902,1004,1063,1099）は例外なく null を書いており、undefined を生成する経路は存在しない（検証済み）。

.nullable().default(null) へ置き換えて型から undefined を除去する。敵対的検証で後方互換も確認済み: dlsiteキー自体が無い最古形式は shared/src/meta.ts:17 の dlsiteStateSchema.default(emptyDlsiteState) で救済され、dlsiteキーはあるが errorKind キーが無い中間世代も zod v4 の .default(null) がキー欠落に適用されるためパースが通る。クライアント側で errorKind を直接読むコードは無し。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 errorKind が .nullable().default(null) となり、型が DlsiteFetchErrorKind | null になっている
- [ ] #2 errorKindフィールドを持たない既存 .meta.json のパースが通ることをテストで確認している
- [ ] #3 pnpm check・pnpm test が通る
<!-- AC:END -->
