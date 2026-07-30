---
id: TASK-65
title: タグ検索クエリのカンマ区切りを廃止する（タグ値のカンマ非対応が不可逆化する前に）
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 03:08'
updated_date: '2026-07-19 03:21'
labels: []
dependencies: []
modified_files:
  - shared/src/api.ts
  - server/src/routes/works.ts
  - server/tests/app.test.ts
  - client/src/features/library/api.ts
  - client/tests/unit/api.test.ts
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー(2026-07-19)指摘20。worksQuerySchema（shared/src/api.ts:9-14）はtagsをカンマ区切り1文字列で受けてsplit(",")し、client（client/src/features/library/api.ts:48）はjoin(",")で送る。一方タグのスキーマ（shared/src/meta.ts:12）とnormalizeTagはカンマを禁止していないため、タグ値にカンマが入ると検索が壊れ、後から直すと既存データと非互換になる。

対応: tagsを複数クエリパラメータ（?tags=a&tags=b）にするか、タグスキーマでカンマを禁止するか、どちらかに寄せて矛盾を解消する。契約(shared)・server・client全層で整合させること。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 タグ値にカンマが含まれるケースで検索の挙動が定義されている（複数パラメータ化 または スキーマでカンマ禁止）
- [x] #2 shared契約・server・clientの全層で表現が一致している
- [x] #3 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. worksQuerySchemaをtags文字列配列の契約へ変更する
2. Honoでc.req.queries("tags")を使って全値を渡す
3. clientをURLSearchParams.appendへ変更し、契約・route・clientテストを更新する
4. 全体チェックとテストを実行する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
tagsは同名クエリパラメータの繰り返しで表現する。タグスキーマでカンマを禁止せず、タグ値内のカンマはURLエンコードして保持する。旧カンマ区切りのフォールバックは設けない。検証: pnpm check / pnpm test 成功。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
works検索のtagsを複数クエリパラメータへ移行し、shared・server・clientとカンマ入りタグのテストを整合させた。pnpm checkとpnpm testで検証済み。
<!-- SECTION:FINAL_SUMMARY:END -->
