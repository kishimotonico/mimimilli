---
id: TASK-26
title: サムネイルキャッシュのGC（古いmtimeキーのファイル掃除）
status: Done
assignee:
  - '@sonnet'
created_date: '2026-07-10 10:31'
updated_date: '2026-07-11 23:49'
labels:
  - backend
dependencies: []
priority: low
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-24のサムネイルキャッシュ（data/cache/thumbnails/、キー=sha256(workId+幅+元mtime)）は、元カバーが更新されるとキーが変わって旧ファイルが参照されなくなるが、削除はされず無限に溜まる設計。ローカル常駐アプリなので緊急性は低いが、長期運用でディスクを浪費する。

方針案: スキャン完了時に「現存する作品×許可幅×現mtime」から有効キー集合を作り、cacheDir内のそれ以外の .webp を削除する（スキャンは全作品を走査する自然なタイミングで、TASK-20のSSE進捗にfinalizingフェーズもある）。起動時フックや世代管理より単純で、実装もreal adapter内に閉じる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 スキャン完了時（または同等の自然なタイミング）に、参照されなくなったサムネイルキャッシュファイルが削除される
- [x] #2 現役のキャッシュ（現mtime・許可幅に対応するファイル）は削除されない
- [x] #3 GCの発動タイミングと削除基準がthumbnailCache.ts（または関連モジュール）のコメントで説明されている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnet実装、Fableレビュー。有効キー集合方式（現存作品×許可幅×現mtime）、tmp孤児は命名規則不一致で自然に対象、stat不能作品はスキップ+件数可視化。生成中tmpとの競合はENOENT再試行で許容（コメント明記）。テスト4ケース、server 135件全パス。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
スキャン完了時のサムネイルキャッシュGCを実装。
<!-- SECTION:FINAL_SUMMARY:END -->
