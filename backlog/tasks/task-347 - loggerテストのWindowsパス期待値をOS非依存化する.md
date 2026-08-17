---
id: TASK-347
title: loggerテストのWindowsパス期待値をOS非依存化する
status: To Do
assignee: []
created_date: '2026-08-14 18:34'
labels:
  - bug
  - server
  - test
  - windows
dependencies: []
references:
  - TASK-344
priority: medium
ordinal: 357000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-344の最終pnpm-testで、server側logger.test.ts:13がWindowsのパス区切りと固定期待値の不一致により失敗した。ログに含めるパスの契約を維持したまま、OS固有の区切りに依存しない検証へ改める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 loggerテストはパス値の意味とログ構造を維持したままOS固有の区切り文字に依存せず検証する
- [ ] #2 logger.test.tsはWindowsで安定して通る
- [ ] #3 Windows以外の既存ログ出力契約とテスト結果を変更しない
- [ ] #4 関連loggerテストとpnpm-testでパス期待値不一致が発生しない
<!-- AC:END -->
