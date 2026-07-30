---
id: TASK-143
title: トラック切替後に古いAudioイベントが新トラックの状態を破壊する競合を塞ぐ
status: To Do
assignee: []
created_date: '2026-07-30 12:33'
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
- [ ] #1 トラックA再生開始直後にBへ切り替えても、Aの遅延エラーイベントでBがerror状態にならないことをテストで確認している
- [ ] #2 世代/トラック照合がaudioEngineとplayerControllerの両方（またはいずれか設計上十分な一方）に入っている
- [ ] #3 既存の再生・切替・レジューム動作が回帰していない（pnpm check・pnpm test）
<!-- AC:END -->
