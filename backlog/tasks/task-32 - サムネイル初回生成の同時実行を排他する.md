---
id: TASK-32
title: サムネイル初回生成の同時実行を排他する
status: To Do
assignee: []
created_date: '2026-07-10 13:41'
labels:
  - bug
  - performance
dependencies: []
references:
  - server/src/adapters/real/thumbnailCache.ts
priority: low
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
同じ作品・幅・mtimeのサムネイルへ初回リクエストが重なると、各リクエストがfileExists=falseを確認した後、同じcachedPathへsharp.toFileを並行実行する。重複変換によるCPU負荷と同一ファイルへの競合書き込みを避け、生成途中のファイルを配信しないキャッシュ生成方式にする。TASK-26の古いキャッシュGCとは独立した初回生成時の整合性問題。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 同一キャッシュキーへの同時リクエストでは画像変換を1回だけ実行し、全リクエストが同じ完成済みファイルを受け取る
- [ ] #2 生成失敗時に壊れたキャッシュファイルを残さず、後続リクエストで再試行できる
- [ ] #3 異なるキャッシュキーの生成は不要に直列化しない
- [ ] #4 同時リクエストと生成失敗を含む自動テストを追加する
<!-- AC:END -->
