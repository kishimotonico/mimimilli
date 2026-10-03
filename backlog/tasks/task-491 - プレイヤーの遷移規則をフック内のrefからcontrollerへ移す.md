---
id: TASK-491
title: プレイヤーの遷移規則をフック内のrefからcontrollerへ移す
status: To Do
assignee: []
created_date: '2026-10-02 11:47'
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
- [ ] #1 トラック終端・仮想終端・同一音源の継続判定がcontrollerの純粋な遷移として単体テストで縛られている
- [ ] #2 useAudioEngineLifecycleがengineイベントの変換とコマンド実行だけを担い、遷移判定の可変refを持たない
- [ ] #3 読み込み済みトラックの扱いに型キャストと非nullアサーションが無い
- [ ] #4 連続再生・単一ファイル作品の仮想トラック・同一音源のトラック移動が現在と同じに動くことをテストで確認している
- [ ] #5 pnpm check && pnpm test && pnpm test:smoke が通る
<!-- AC:END -->
