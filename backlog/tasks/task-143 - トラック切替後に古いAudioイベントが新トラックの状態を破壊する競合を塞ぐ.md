---
id: TASK-143
title: トラック切替後に古いAudioイベントが新トラックの状態を破壊する競合を塞ぐ
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 12:33'
updated_date: '2026-07-30 15:45'
labels: []
dependencies: []
priority: high
ordinal: 153000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A→B切替直後、Aの古い play() Promise の遅延reject（AbortError等）でBの再生が error 状態に落ちうる（敵対的検証済み・Codexレビュー指摘#5）。3層すべてに防御が無いことを確認済み。

事実:
- client/src/features/player/model/audioEngine.ts:129-131 playAudio() は audio.play().catch(...onError) で世代/トラック照合なし、AbortErrorのフィルタもなし
- audioEngine.ts:164-196 load() は新規 src 代入時に旧 play() Promise を無効化しない
- useAudioEngineLifecycle.ts:123-125 は onError を無条件で controller.dispatch({type:"audioFailed"})
- playerController.ts:342-346 audioFailed も item/トラック照合なしで無条件に status:"error"

方向: load/play の世代トークンをコールバックへ含め、現在の asset・トラックと一致するイベントだけ受理する。controller 側でも現在の item と照合しない audioFailed / audioPlaying を拒否する。

注意: HANDOFF記載の「同一アセット再利用時に audioPlaying を代理dispatchする」経路（useAudioEngineLifecycle）を壊さないこと。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 トラックA再生開始直後にBへ切り替えても、Aの遅延エラーイベントでBがerror状態にならないことをテストで確認している
- [x] #2 世代/トラック照合がaudioEngineとplayerControllerの両方（またはいずれか設計上十分な一方）に入っている
- [x] #3 既存の再生・切替・レジューム動作が回帰していない（pnpm check・pnpm test）
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. audioEngineにload世代トークンを導入しplay()遅延reject・コールバックへ世代を付与
2. useAudioEngineLifecycleで世代不一致イベントを破棄
3. playerControllerのaudioFailed/audioPlayingでitem照合（設計上十分な側に防御）
4. 競合の回帰テスト追加、pnpm check + pnpm test:client
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor(composer-2.5)で実装。防御はaudioEngine層を主（playTokenでplay()遅延rejectを無効化、load世代スコープのerrorリスナー+MEDIA_ERR_ABORTED除外）、playerController層をセーフティネット（item無し/idle/endedへのaudioFailed無視）の二段。client check+test:client 370件を統括側でも再実行し通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
audioEngineにload/play世代トークンを導入し、トラック切替後の旧play() rejectと旧srcのmedia errorを破棄。reducePlayerのaudioFailedにも対象外イベントの拒否を追加。A→B切替直後の遅延AbortErrorでBがerrorにならないことをテストで固定。
<!-- SECTION:FINAL_SUMMARY:END -->
