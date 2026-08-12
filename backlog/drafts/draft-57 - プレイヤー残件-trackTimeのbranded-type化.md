---
id: DRAFT-57
title: 'プレイヤー残件: trackTimeのbranded type化'
status: Draft
assignee: []
created_date: '2026-08-12 10:35'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DRAFT-26（archive済み）の残件。

PlayerController状態機械（playerController.ts、idle/loading/playing/paused/ended/error）、resume契約の{playlistId, trackId, offsetSec}化、Playlist/Trackの安定UUID、聴了イベントの分離（PlaybackCompletionScope: queue/work）、reducerシナリオテストは実装済み。

残るのは client/src/features/player/model/trackTime.ts の絶対秒/トラック相対秒が素のnumberのままの点。AudioEngine境界だけが絶対秒を扱う設計をbranded typeで固定する。

なおDRAFT-26が提案していたresume契約へのrevision（競合検知）追加は、2026-08-12設計レビュー（docs/application-architecture-review-2026-08-12.md スマホUI節B）が「resumeはserver到着順のlast-write-winsと仕様化し、device identity・CAS・leaseは追加しない」方針のため見送り。
<!-- SECTION:DESCRIPTION:END -->
