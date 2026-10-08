---
id: TASK-491
title: プレイヤーの遷移規則をフック内のrefからcontrollerへ移す
status: Done
assignee:
  - '@mimi2'
created_date: '2026-10-02 11:47'
updated_date: '2026-10-08 06:44'
labels:
  - client
  - player
  - refactor
dependencies: []
documentation:
  - backlog/docs/doc-7
priority: medium
ordinal: 549000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
useAudioEngineLifecycle.ts では trackEnded を onPlay/onPause/onTimeUpdate/finishCurrentTrack が読み書きし、同じ音源を続けて使うか（assetUrlの比較）、仮想終端の判定、reusesLoadedAsset 分岐でのseekと audioTimeUpdated の直接dispatch がフック内にある。loadedTrack・filesModeFileDurationSec・loadCleanup は PlayerRuntimeRefs にあり、遷移規則の一部がreducerの単体テストで縛れない。TASK-128の回避策のような手動の収束処理もこの二重化から来ている。trackEnded・仮想終端・同一音源判定をcontrollerの状態と入力イベントに移し、effect側はengineのイベント変換とコマンド実行だけにする。WorkspacePathへのキャストとworkIdの非nullアサーションは、読み込み済みトラックを判別共用体にして消す。TASK-368の続き。詳細は doc-7 の cli-ui-3。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 トラック終端・仮想終端・同一音源の継続判定がcontrollerの純粋な遷移として単体テストで縛られている
- [x] #2 useAudioEngineLifecycleがengineイベントの変換とコマンド実行だけを担い、遷移判定の可変refを持たない
- [x] #3 読み込み済みトラックの扱いに型キャストと非nullアサーションが無い
- [x] #4 連続再生・単一ファイル作品の仮想トラック・同一音源のトラック移動が現在と同じに動くことをテストで確認している
- [x] #5 pnpm check && pnpm test && pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
挙動の補足（2026-10-08）: 停止時のコマンド列から seekAudio(0) と releaseLoadedTrack を外した。stopRequested は item と loaded を null にするので、停止後の再生は必ず startRequested（usePlayWork 経由）で選んだトラックの開始位置から再ロードされ、前回の再生位置からは始まらない（旧と同じ）。engine に残る位置は次の load で上書きされるだけで、ユーザーに見える違いは無い。別件として、終端まで再生して止まったトラックで再生ボタンを押すと先頭へ戻って再生し直す挙動は、旧 onPlay の判定と同じものを reducer に移したもの。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
トラック終端・仮想終端・同一音源の継続判定を playerController の state と入力イベントへ移し、useAudioEngineLifecycle は engine イベントの変換とコマンド実行だけに。読み込み済みトラックを判別共用体 LoadedTrack にしてキャストと非 null アサーションを消し、TASK-128 の手動収束を不要にした。 個別レビュー＋統合ブランチの横断レビュー、master への仮マージで pnpm check・test（server 951 / client 1339）・smoke 30 全通過、fixture でのブラウザ確認（再生・作品編集・スキャン・root 再設定）で崩れ・エラーなし。61e4b7bb で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
