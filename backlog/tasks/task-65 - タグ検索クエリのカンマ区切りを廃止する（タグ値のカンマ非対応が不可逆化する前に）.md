---
id: TASK-65
title: タグ検索クエリのカンマ区切りを廃止する（タグ値のカンマ非対応が不可逆化する前に）
status: To Do
assignee: []
created_date: '2026-07-19 03:08'
labels: []
dependencies: []
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー(2026-07-19)指摘20。worksQuerySchema（shared/src/api.ts:9-14）はtagsをカンマ区切り1文字列で受けてsplit(",")し、client（client/src/features/library/api.ts:48）はjoin(",")で送る。一方タグのスキーマ（shared/src/meta.ts:12）とnormalizeTagはカンマを禁止していないため、タグ値にカンマが入ると検索が壊れ、後から直すと既存データと非互換になる。

対応: tagsを複数クエリパラメータ（?tags=a&tags=b）にするか、タグスキーマでカンマを禁止するか、どちらかに寄せて矛盾を解消する。契約(shared)・server・client全層で整合させること。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 タグ値にカンマが含まれるケースで検索の挙動が定義されている（複数パラメータ化 または スキーマでカンマ禁止）
- [ ] #2 shared契約・server・clientの全層で表現が一致している
- [ ] #3 pnpm check と pnpm test が通る
<!-- AC:END -->
