---
id: TASK-448.4
title: スキャン完了時の finalizeScan の呼び出し経路を一本化する
status: To Do
assignee: []
created_date: '2026-09-11 08:19'
updated_date: '2026-10-02 11:50'
labels:
  - refactor
  - triage
dependencies: []
parent_task_id: TASK-448
priority: medium
ordinal: 500000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
real adapter でスキャン完了時の finalizeScan が、DB 種別 files のときは scanWorker.ts 経由、それ以外は settingsScanMethods.ts 自身から呼ばれる二重経路になっている。integrityLogContext の文字列も scan-thumbnail-gc / scan-worker-thumbnail-gc で個別に書かれている。呼び出し経路を1つにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 finalizeScan の呼び出しが1つの経路にまとまり、integrityLogContext の個別文字列の重複が無い
- [ ] #2 スキャン完了時の後処理（サムネイル GC 等）が両方の DB 種別で同じ経路を通ることがテストで縛られている
- [ ] #3 挙動は変わらず、既存テストの期待値を変えていない。pnpm check・pnpm test が通る
- [ ] #4 スキャン完了時のサムネイルGCが、メインスレッドで生成中の一時ファイルを削除しない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-02構造点検（doc-6・doc-7）より: finalizeScanはscanWorker内でgcThumbnailCacheを実行し、生成中の .tmp-<pid>-<n> も孤児として消す（thumbnailCache.tsのコメントで許容と明記）。メインスレッドはスキャン中もカバー要求でサムネイルを生成し続けるので、完了の瞬間に生成中だとrenameがENOENTで失敗する。.tmp- はGC対象から外し、古いものだけmtimeで掃除する。AC#3の「挙動は変わらず」はこの修正以外を指す（doc-6 jobs-6）。
<!-- SECTION:NOTES:END -->
