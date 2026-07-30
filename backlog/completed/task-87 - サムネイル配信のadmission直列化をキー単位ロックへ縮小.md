---
id: TASK-87
title: サムネイル配信のadmission直列化をキー単位ロックへ縮小
status: Done
assignee: []
created_date: '2026-07-23 05:58'
updated_date: '2026-07-23 10:22'
labels: []
dependencies: []
priority: high
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ThumbnailCache.getOrCreate が全リクエストを単一 admissionTail Promiseチェーンへ連結し(server/src/adapters/real/thumbnailCache.ts:88-178)、admit(stat/mkdir/inFlight登録)がキー無関係にFIFO直列化される。WorkGridスクロールで数百件が一斉リクエストされる典型ケースで、大半が即返せるキャッシュヒットなのに1件ずつのstatが完全直列になり、Sharp並列制御でスループット向上を狙った目的とhead-of-lineブロッキングで矛盾する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 グローバルなadmissionTail直列化を廃し、キャッシュキー単位のロック(Map<cachedPath, Promise>)に置き換える
- [ ] #2 同一キーのinFlight合流(重複生成防止)は維持されている
- [ ] #3 異なるキーのキャッシュヒットが並行に処理されることをテストで確認する
<!-- AC:END -->
