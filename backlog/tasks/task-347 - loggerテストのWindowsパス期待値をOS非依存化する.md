---
id: TASK-347
title: loggerテストのWindowsパス期待値をOS非依存化する
status: Done
assignee: []
created_date: '2026-08-14 18:34'
updated_date: '2026-08-17 18:49'
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
- [x] #1 loggerテストはパス値の意味とログ構造を維持したままOS固有の区切り文字に依存せず検証する
- [x] #2 Windows以外の既存ログ出力契約とテスト結果を変更しない
- [x] #3 関連loggerテストとpnpm-testでパス期待値不一致が発生しない
- [x] #4 logger.test.tsがパス区切りに依存しない形になり、Linuxで安定して通る（Windows実機確認は次回ドッグフーディング）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
洗い出し: server/tests/logger.test.ts の lastIndexOf("/") のみ修正対象。server/tests/real/dataRoot.test.ts の endsWith("/custom-data") は platform="linux" 明示の POSIX パステストのため対象外。client/tests の startsWith/endsWith("/...") は URL パス。shared に tests ディレクトリなし。Windows 実機での確認は未実施（次回ドッグフーディング）。logger.test.ts を Linux で 10 回連続実行し全 pass（各回 6 pass / 0 fail）。負の検証: dirname 比較を join(logDir,"wrong") に壊すと AssertionError（actual が logDir、expected が logDir/wrong）で 1 fail を確認後に復元。
<!-- SECTION:NOTES:END -->
