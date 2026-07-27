---
id: TASK-110
title: 一時停止中のトラック切替で再生が再開する問題を直しloadTrackコマンドを実配線する
status: To Do
assignee: []
created_date: '2026-07-27 01:56'
labels:
  - client
  - player
  - bug
dependencies: []
priority: high
ordinal: 118000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
コンポーネント設計レビュー（2026-07-27）で発見。ブラウザで再現確認済み。

再現手順:
1. 作品を再生する
2. 一時停止する
3. 「次のトラック」を押す
4. 一時停止していたはずが再生が再開する

原因:
- playerController.ts:110 の withTrackIndex はトラック切替時に status を変えない（一時停止中なら paused のまま）。発行するのは persistResume と loadTrack コマンドだけ
- ところが usePlayer.ts:143 のコマンド購読は case "loadTrack" を break の no-op にしていて、実際のロードは useAudioEngineLifecycle.ts:139 の state 差分 effect が代行している
- その effect の新規ロード経路は engine.load() を呼び、audioEngine.ts:183 の load は最後に無条件で playAudio() する。宣言的な状態機械（controller）を命令的な副作用が上書きしている
- 同一音源の再利用経路（useAudioEngineLifecycle.ts:186-192）は if (coreState.isPlaying) を見ているので、この非対称自体がバグの証拠

派生する別の問題（同じ設計原因、未再現）:
- state 差分 effect の deps は [currentTrackIndex, tracks, currentWork] なので、同じ作品・同じ配列参照・同じ index で再生要求してもロードとシークが走らない。例えば同一作品の同一トラックに対して「最初から再生」を押した場合に先頭へ戻らない可能性がある

修正方針（Codexと相談した結論）:
- engine.load に autoplay フラグを渡すだけの局所修正でも一時停止の件は直るが、本質的には既に存在する loadTrack コマンドを実ロード処理へ接続し、コマンドに再生意図を持たせる。既存のコマンド設計を完成させる修正なので過剰ではない

着手前に、上記の派生問題が実際に再現するかを確認すること。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 再生 → 一時停止 → 次のトラック で再生が再開しない
- [ ] #2 再生中に次のトラックへ切り替えた場合は従来どおり再生が継続する
- [ ] #3 loadTrack コマンドが no-op ではなく実際のロード処理に接続されている
- [ ] #4 同一作品・同一トラックに対する再生要求（最初から再生）で先頭にシークされる
- [ ] #5 同一ファイル内の区間トラック切替（再ロードなしのシーク）が従来どおり動作する
<!-- AC:END -->
