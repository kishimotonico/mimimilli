---
id: TASK-232
title: 起動ログに実データパスを記録する
status: Done
assignee: []
created_date: '2026-08-07 12:50'
updated_date: '2026-08-08 11:33'
labels: []
dependencies: []
references:
  - docs/adr/0011-logging-logtape-jsonl.md
priority: medium
ordinal: 242000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Windowsでの開発ドッグフード時に、どのデータ領域とログファイルを使って起動したかをコンソールとJSONLから確認できるようにする。製品向け診断UIは作らず、既存のserver起動INFOを充実させる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 real adapterの起動INFOに、解決済みdata root、catalog DB、user DB、log fileの絶対パスがpropertiesとして記録される
- [x] #2 ログ初期化処理が実際に選んだlog fileパスを呼び出し元へ返し、起動側でファイル名生成規則を重複実装しない
- [x] #3 fixture adapterの起動INFOには存在しないDBパスやlog fileを空値・推測値で記録しない
- [x] #4 既存のconsole sinkとreal adapterのfile sink、起動メッセージ、正常終了時のflush挙動が維持される
- [x] #5 realとfixtureの起動ログ差分を対象テストで確認できる
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
initLoggerがInitLoggerResult(logFilePath)を返し、起動INFOにreal時のdataRoot/catalogDb/userDb/logFileをpropertiesとして記録。fixture時は存在しないキーを出さない(startupLog.ts)。ログディレクトリ作成失敗時はパスとerrnoが読めるエラーで異常終了。pnpm check・serverテスト523件パスで検証。コミット70089c7、マージa00f1a9
<!-- SECTION:FINAL_SUMMARY:END -->
