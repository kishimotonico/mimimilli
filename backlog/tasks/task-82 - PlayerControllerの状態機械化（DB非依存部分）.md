---
id: TASK-82
title: PlayerControllerの状態機械化（DB非依存部分）
status: To Do
assignee: []
created_date: '2026-07-19 05:08'
labels: []
dependencies: []
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DRAFT-26のDB非依存系統の実装（doc-1指摘3,6,21）。DB分離とは独立で、いつでも着手可能（並行レーン）。

やること:
- React外にPlayerControllerを置き、idle/loading/playing/paused/ended/error と再生項目を明示したreducer/state machineへ移行。現在atom+ref+effectに拡散している暗黙の状態遷移（client/src/features/player/model/: atoms.ts, usePlayer.ts, useAudioEngineLifecycle.ts, useResumePersistence.ts, playerRuntime.ts）を集約する
- React・AudioEngine・永続化・MediaSessionはイベントとコマンドで接続。永続化はLoadResume/PersistResumeのようなポートにし、resume v2（TASK-81）の実装をControllerが知らない形にする
- 「聴了」をドメインイベントに分離（現状は渡されたtracks配列の末尾=聴了で、Filesモードの単発再生と将来のキューに耐えない。PlaybackQueue終了とWorkCompletionを区別）
- テスト再構成: usePlayer.test.ts（756行、FakeAudioの内部イベント順序に結合）をPlayerControllerのシナリオテスト+HTMLAudio adapterの少数契約テストへ分離
- 状態機械ライブラリの導入は必須ではない。素朴なreducerで十分（オーバーエンジニアリング回避）

先に「状態・イベント・コマンド一覧を決める」設計サブタスクを切ってから実装に入ること（pnpm backlog task create -p でサブタスク作成可）。既存挙動（区間トラック相対時間・A-Bリピート・loop・聴了リセット・同一ファイルシーク切替・MediaSession連携）は全部維持し、既存テストが検証する仕様を壊さない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 プレイヤーの状態遷移が明示的なreducer/state machineに集約され、React外で単体テストできる
- [ ] #2 聴了がドメインイベントとして分離され、Filesモード単発再生で作品聴了扱いにならない
- [ ] #3 既存のプレイヤー挙動（区間トラック・A-B・loop・レジューム・MediaSession）が回帰しない
- [ ] #4 pnpm check と pnpm test が通る
<!-- AC:END -->
