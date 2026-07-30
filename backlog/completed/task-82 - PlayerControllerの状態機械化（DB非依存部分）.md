---
id: TASK-82
title: PlayerControllerの状態機械化（DB非依存部分）
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 05:08'
updated_date: '2026-07-19 11:28'
labels: []
dependencies: []
modified_files:
  - client/src/features/player/model/playerController.ts
  - client/src/features/player/model/atoms.ts
  - client/src/features/player/model/playerRuntime.ts
  - client/src/features/player/model/usePlayer.ts
  - client/src/features/player/model/useAudioEngineLifecycle.ts
  - client/src/features/player/model/useResumePersistence.ts
  - client/tests/unit/playerController.test.ts
  - client/tests/unit/audioEngine.test.ts
  - client/tests/unit/resumePersistence.test.ts
  - client/tests/unit/format.test.ts
  - client/tests/unit/usePlayer.test.ts
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
- [x] #1 プレイヤーの状態遷移が明示的なreducer/state machineに集約され、React外で単体テストできる
- [x] #2 聴了がドメインイベントとして分離され、Filesモード単発再生で作品聴了扱いにならない
- [x] #3 既存のプレイヤー挙動（区間トラック・A-B・loop・レジューム・MediaSession）が回帰しない
- [x] #4 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. TASK-82.1で状態・入力イベント・外部コマンドと聴了条件を確定する
2. pure reducerとPlayerController骨格、シナリオテストを追加する
3. AudioEngineをControllerのコマンド・イベントへ接続する
4. resume v2をController非依存の永続化ポートへ移す
5. PlaybackQueueEndedとWorkCompletedを分離し、Files経路を検証する
6. HTMLAudio adapter契約テストへ再構成する
7. pnpm checkとpnpm testを実行する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装結果:
- playerController.tsにPlayerController、pure reducer、idle/loading/playing/paused/ended/error、PlaybackItem、入力イベント、外部コマンドを集約した
- usePlayerの公開返却APIは維持し、JotaiはController stateの投影先にした
- AudioEngine callbackはController入力イベントへ変換し、再生・シーク・設定・resume保存はControllerコマンドとして接続した
- resume v2の解決と保存形式はuseResumePersistenceのポート側に閉じ込め、Controllerは開始相対位置とPersistResumeだけを扱う
- PlaybackQueueEndedは全キュー末尾、WorkCompletedはplaylist付き作品再生だけで発火する。Filesのplaylistなし単発再生はresume先頭リセットしない
- usePlayer.test.tsを844行から接続契約中心へ縮小し、PlayerControllerシナリオ、HTMLAudio契約、resumeポート、formatのテストへ分割した

検証:
- pnpm check: 成功
- pnpm test: server 183件、client 242件、全件成功

詳細レビューで4件の挙動回帰が見つかったため再開する。A-B終端とトラック終了の競合、同一asset loopのloading停止、loading中toggle、Audioエラー時resume保存をそれぞれ回帰テスト付きで修正する。

詳細レビュー4件の修正:
- B点が区間終端と一致するとき、A-BのseekAudioを検出してfinishCurrentTrackを中止する回帰テストを追加
- 同一assetの次区間があるloopでplayイベントが再発火しなくてもplayingを維持し、trackEndedを解除する回帰テストを追加
- loading中のtoggleがpauseAudioを出すreducerテストを追加
- Audioエラー遷移がpersistResume(reason=error)を出し、直近相対位置を保存するreducer・接続テストを追加

再検証:
- pnpm check: 成功
- pnpm test: server 183件、client 246件、全件成功

ブラウザ実機回帰(6項目全合格): 再生トグル連打で状態破綻なし・区間トラック相対時間・切替即時/一時停止維持・loop(トラック先頭へ戻る)・resume復帰・コンソールエラーなし。詳細レビュー指摘の回帰4件(A-B終了処理・loopスタック・loading中toggle・エラー時保存)も修正済み。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
React外のPlayerControllerとpure reducerへ状態遷移を集約し、Audio・resume・MediaSession/Jotai接続をイベントとコマンドの境界へ移した。詳細レビューで見つかったA-B終端、同一asset loop、loading toggle、Audioエラー保存の4回帰も個別テスト付きで修正した。pnpm check、server 183件、client 246件のテストが成功した。
<!-- SECTION:FINAL_SUMMARY:END -->
