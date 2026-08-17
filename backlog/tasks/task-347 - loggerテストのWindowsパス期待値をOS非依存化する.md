---
id: TASK-347
title: loggerテストのWindowsパス期待値をOS非依存化する
status: To Do
assignee: []
created_date: '2026-08-14 18:34'
updated_date: '2026-08-17 17:59'
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
- [ ] #2 Windows以外の既存ログ出力契約とテスト結果を変更しない
- [ ] #3 関連loggerテストとpnpm-testでパス期待値不一致が発生しない
- [ ] #4 logger.test.tsがパス区切りに依存しない形になり、Linuxで安定して通る（Windows実機確認は次回ドッグフーディング）
<!-- AC:END -->
