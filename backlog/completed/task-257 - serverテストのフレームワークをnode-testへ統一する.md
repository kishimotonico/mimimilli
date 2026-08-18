---
id: TASK-257
title: 'serverテストのフレームワークをnode:testへ統一する'
status: Done
assignee:
  - '@codex'
created_date: '2026-08-08 13:35'
updated_date: '2026-08-12 12:36'
labels: []
dependencies: []
ordinal: 267000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server/tests は node:test + node:assert/strict が既存規約（29ファイル）だが、TASK-209で追加された server/tests/real/classificationMethods.test.ts のみ bun:test を使っており規約から浮いている。node:test へ書き換えて統一する。bunランナーは両APIを実行できるため動作上の問題はなく、規約統一のみが目的。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 server/tests 配下から bun:test の import が消え、全テストが node:test + node:assert/strict に統一されていること
- [x] #2 変更範囲のserverテストが通ること
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 対象テストと server/tests の import を確認する。 2. bun:test を node:test と node:assert/strict に置き換え、assert.deepStrictEqual で同じ期待値を検証する。 3. 対象テストを実行し、受け入れ条件と実装メモを更新する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
classificationMethods.test.ts を node:test と node:assert/strict に統一し、bun:test の import が server/tests からなくなったことを確認した。pnpm --filter @mimimilli/server exec bun test tests/real/classificationMethods.test.ts は 1 pass / 0 fail。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
server/tests/real/classificationMethods.test.ts を node:test と node:assert/strict に統一し、対象テストを通過させた。
<!-- SECTION:FINAL_SUMMARY:END -->
