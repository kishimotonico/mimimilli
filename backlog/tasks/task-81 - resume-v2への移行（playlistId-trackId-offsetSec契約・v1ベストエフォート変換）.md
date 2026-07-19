---
id: TASK-81
title: resume v2への移行（playlistId/trackId/offsetSec契約・v1ベストエフォート変換）
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 05:08'
updated_date: '2026-07-19 08:57'
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
- [x] #1 resume保存・復元がplaylistId/trackId/offsetSecで動き、トラック並べ替え後も正しいトラックに復帰する
- [x] #2 ID解決できないresumeは無効として扱われ、推測復旧しない
- [x] #3 区間トラック（start/end付き）でoffsetSecが区間相対で保存・復元される
- [x] #4 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. sharedのresume/Work契約をplaylistId・trackId・offsetSecへ変更する
2. user DBスキーマとreal/fixture保存読出しをv2化し、所属・区間検証とv1ベストエフォート変換を実装する
3. clientの保存・復元・pendingResume・表示をID/トラック相対秒へ移行する
4. server/clientテストを更新・追加し、pnpm checkとpnpm testを通す
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
resumeはWork上でnullableなv2オブジェクトとして返す。user DB v2→v3 migrationでは旧値をresume_v1_pendingへ退避する。変換はcatalog構築済みのスキャン完了後に実行し、成功行だけpendingから削除する。未解決行は保持して次回スキャン後に再試行する。
clientはresume IDを解決できない場合、推測復旧せずdefault Playlistの先頭から再生する。
end省略Trackはaudio_probe_cacheに正の実ファイル長があればfileDuration-startを上限に使う。未取得・取得失敗時は上限不明として検証をスキップする。
検証: pnpm check成功。pnpm test成功（server 182件、client 245件）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
resume v2移行とレビュー指摘3件を実装。v1 pendingをスキャン後に再試行する方式へ修正し、初回legacy移行からの復元を確認した。無効resume IDはdefault Playlist先頭再生へ切り替え、end省略Trackはプローブ済みファイル長で保存・読出しを検証する。300秒から60秒への実ファイル差し替えを含むテストを追加し、pnpm checkとpnpm testを通過。
<!-- SECTION:FINAL_SUMMARY:END -->
