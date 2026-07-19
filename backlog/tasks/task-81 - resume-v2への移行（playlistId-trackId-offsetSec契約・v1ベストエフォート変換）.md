---
id: TASK-81
title: resume v2への移行（playlistId/trackId/offsetSec契約・v1ベストエフォート変換）
status: To Do
assignee: []
created_date: '2026-07-19 05:08'
labels: []
dependencies:
  - TASK-80
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0008の実装第4弾。TASK-80（Playlist/Track ID）が前提。

やること:
- resume契約を {playlistId, trackId, offsetSec}（offsetSecはトラック区間先頭からの相対秒）へ変更。shared/src/api.tsのresumeBodySchema、server保存（user DB）、client（usePlayer/useResumePersistence）を全層で切替
- 保存・読出時にPlaylist∈Work、Track∈Playlist、offsetが区間内であることを検証。ID解決失敗=無効（index等から推測復旧しない）
- v1（trackIndex+ファイル絶対秒）からはベストエフォート変換（変換できない値は捨ててよい、件数をログに残す）。ADR-0008修正版参照
- CAS/revision競合制御は導入しない（DRAFT-22着手時まで保留、ADR-0008に理由記載済み）

関連: client側の現実装は usePlayer.ts / useResumePersistence.ts / useAudioEngineLifecycle.ts（TASK-55で分割済み）。resume保存は絶対秒前提のコメントがあるので一掃すること。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 resume保存・復元がplaylistId/trackId/offsetSecで動き、トラック並べ替え後も正しいトラックに復帰する
- [ ] #2 ID解決できないresumeは無効として扱われ、推測復旧しない
- [ ] #3 区間トラック（start/end付き）でoffsetSecが区間相対で保存・復元される
- [ ] #4 pnpm check と pnpm test が通る
<!-- AC:END -->
