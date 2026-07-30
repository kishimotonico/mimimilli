---
id: TASK-82.1
title: PlayerControllerの状態・イベント・コマンドを設計する
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 10:49'
updated_date: '2026-07-19 11:14'
labels: []
dependencies: []
parent_task_id: TASK-82
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-82の実装前に、React外のPlayerControllerが扱う状態、入力イベント、外部へ通知するコマンドを確定する。doc-1指摘3・6・21とDRAFT-26を根拠に、既存の区間トラック、A-Bリピート、loop、resume v2、MediaSession、同一ファイル切替を維持できる境界を定める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 状態・入力イベント・外部コマンドの一覧が記録されている
- [x] #2 PlaybackQueueEndedとWorkCompletedの発生条件が分離されている
- [x] #3 resume v2のDTOをControllerへ持ち込まない永続化ポートが定義されている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 既存の暗黙状態と副作用を列挙する
2. reducerの状態・入力イベント・外部コマンドを定義する
3. 聴了条件とresumeポートの境界を定義する
4. TASK-82の実装計画へ反映する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装に採用した一覧:

状態:
- status: idle / loading / playing / paused / ended / error
- item: work、playlistId、tracks、trackIndex、completionScope。idleではnull
- positionSec / durationSec: トラック相対秒
- options: volume、loop、playbackRate、channelSwap、A-B区間、full player表示
- playbackError: error状態のAudioEngineError

Controllerへの入力イベント:
- startRequested / playRequested / pauseRequested / toggleRequested / stopRequested
- seekRequested / seekRelativeRequested
- nextRequested / previousRequested / trackSelected
- volumeChanged / loopChanged / playbackRateChanged / channelSwapChanged
- abPointSet / abCleared / fullPlayerVisibilityChanged
- audioPlaying / audioPaused / audioTimeUpdated / audioDurationChanged / audioEnded / audioFailed
- persistTick

Controllerから外部へのコマンド:
- loadTrack / playAudio / pauseAudio / seekAudio
- setAudioVolume / setAudioPlaybackRate / setAudioChannelSwap
- persistResume（track-change / pause / stop / interval）
- playbackQueueEnded / workCompleted

永続化ポート:
- loadResumeはReactアダプター側でresume v2をplaylist・track index・相対位置へ解決し、startRequestedへ渡す
- persistResumeとworkCompletedのコマンドはアダプターがresume v2保存へ変換する。ControllerはResumeBodyを参照しない

MediaSession接続:
- 操作handlerはusePlayerの公開操作を通じてController入力イベントへ変換する
- メタデータ、再生状態、位置はController stateをJotaiへ投影した値から更新する

聴了条件:
- 末尾到達では常にplaybackQueueEndedを出す
- completionScope=workの場合だけworkCompletedも出す
- Files経路はplaylistIdなしのcompletionScope=queueとなり、workCompletedとresume先頭リセットを出さない

実装構造:
- reducePlayerはstateと外部コマンド列を返すpure reducer
- PlayerControllerはdispatchとstate/command購読を担う
- HTMLAudio固有の絶対秒、loaded asset、同一ファイル再利用判定はAudioアダプターに残す

レビュー反映:
- persistResumeのreasonにerrorを追加した
- loopのaudioEndedはplayingを維持する
- loading中のtoggleはpauseAudioを出す
- audioTimeUpdatedがA-BのseekAudioを出した場合、Audioアダプターはトラック終了処理を行わない
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
実装前に状態・入力イベント・外部コマンド・resumeポート・聴了条件を確定し、実装後に採用した最小のイベント/コマンド一覧へ記録を同期した。
<!-- SECTION:FINAL_SUMMARY:END -->
