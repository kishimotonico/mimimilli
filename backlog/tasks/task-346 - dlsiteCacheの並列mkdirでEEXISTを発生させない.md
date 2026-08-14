---
id: TASK-346
title: dlsiteCacheの並列mkdirでEEXISTを発生させない
status: To Do
assignee: []
created_date: '2026-08-14 18:33'
labels:
  - bug
  - server
  - test
  - windows
dependencies: []
references:
  - TASK-344
priority: medium
ordinal: 356000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-344の最終pnpm-testで、server/src/adapters/real/dlsiteCache.ts:170のmkdirに対し、並列実行時に既存のカレント相当ディレクトリを作成しようとしてEEXISTが発生した。ディレクトリ準備を並列・既存状態に対して冪等にし、DLsiteキャッシュ処理を安定させる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 DLsiteキャッシュの出力先ディレクトリ準備は既存ディレクトリおよびカレント相当パスに対して成功する
- [ ] #2 複数処理が同じ出力先を並列に準備してもEEXISTを送出しない
- [ ] #3 mkdir競合を再現するテストが追加され、Windowsで10回連続して安定して通る
- [ ] #4 関連するDLsiteキャッシュのreal-testsが並列実行で通る
<!-- AC:END -->
