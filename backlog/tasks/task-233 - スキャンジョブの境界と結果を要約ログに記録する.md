---
id: TASK-233
title: スキャンジョブの境界と結果を要約ログに記録する
status: To Do
assignee: []
created_date: '2026-08-07 12:50'
labels: []
dependencies:
  - TASK-232
references:
  - docs/adr/0011-logging-logtape-jsonl.md
priority: medium
ordinal: 243000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Windowsでの開発ドッグフード時に、スキャン全体の開始から終端までを既存JSONLとコンソールで追跡できるようにする。進捗や作品配列を全件記録せず、ScanJobManagerの処理境界へ必要最小限の要約を置く。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スキャン開始時にjobId、full、対象rootをscanカテゴリのINFOとして1回記録する
- [ ] #2 完了時にjobId、durationMs、registered、newlyGenerated、errors、missing、skipped、coverErrors、rjCodeMissingCountをINFOとして1回記録し、newWorkIds配列は記録しない
- [ ] #3 完了時にunreadablePathsの件数と先頭N件、dataIntegrityWarningの有無を記録し、ログ量に上限がある
- [ ] #4 取消時はjobIdとdurationMsをINFO、失敗時はjobId、durationMs、errorKind、message、stackをERRORとして各1回記録する
- [ ] #5 real Worker内で発生した失敗の元のstackとerrorKindが親プロセスまで保たれ、親側で作り直したErrorのstackに置き換わらない
- [ ] #6 fixtureとrealの両経路が同じScanJobManagerのライフサイクルログを使い、スキャン進捗イベントごとのログは追加しない
- [ ] #7 完了・取消・失敗とWorkerエラー伝播を対象テストで確認できる
<!-- AC:END -->
