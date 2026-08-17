---
id: TASK-346
title: dlsiteCacheの並列mkdirでEEXISTを発生させない
status: Done
assignee: []
created_date: '2026-08-14 18:33'
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
ordinal: 356000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-344の最終pnpm-testで、server/src/adapters/real/dlsiteCache.ts:170のmkdirに対し、並列実行時に既存のカレント相当ディレクトリを作成しようとしてEEXISTが発生した。ディレクトリ準備を並列・既存状態に対して冪等にし、DLsiteキャッシュ処理を安定させる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 DLsiteキャッシュの出力先ディレクトリ準備は既存ディレクトリおよびカレント相当パスに対して成功する
- [x] #2 複数処理が同じ出力先を並列に準備してもEEXISTを送出しない
- [x] #3 関連するDLsiteキャッシュのreal-testsが並列実行で通る
- [x] #4 mkdir競合を再現するテストが追加され、10回連続実行で安定して通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
原因: 相対パス指定時に dirname() が "." を返し、Windows では mkdirSync(".", {recursive:true}) が EEXIST を投げる（Linux は no-op）。対応: DlsiteCache コンストラクタで path.resolve() により絶対化してから mkdirSync。prepareExportDirectory は readdirSync の ENOENT 判定後に mkdir する構造のため変更不要。Windows 実機での確認は未実施（次回ドッグフーディング）。
<!-- SECTION:NOTES:END -->
