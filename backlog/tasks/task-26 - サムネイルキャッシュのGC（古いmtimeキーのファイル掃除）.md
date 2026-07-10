---
id: TASK-26
title: サムネイルキャッシュのGC（古いmtimeキーのファイル掃除）
status: To Do
assignee: []
created_date: '2026-07-10 10:31'
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
- [ ] #1 スキャン完了時（または同等の自然なタイミング）に、参照されなくなったサムネイルキャッシュファイルが削除される
- [ ] #2 現役のキャッシュ（現mtime・許可幅に対応するファイル）は削除されない
- [ ] #3 GCの発動タイミングと削除基準がthumbnailCache.ts（または関連モジュール）のコメントで説明されている
<!-- AC:END -->
