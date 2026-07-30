---
id: TASK-110
title: 一時停止中のトラック切替で再生が再開する問題を直しloadTrackコマンドを実配線する
status: Done
assignee: []
created_date: '2026-07-27 01:56'
updated_date: '2026-07-30 08:39'
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
- [x] #1 再生 → 一時停止 → 次のトラック で再生が再開しない
- [x] #2 再生中に次のトラックへ切り替えた場合は従来どおり再生が継続する
- [x] #3 loadTrack コマンドが no-op ではなく実際のロード処理に接続されている
- [x] #4 同一作品・同一トラックに対する再生要求（最初から再生）で先頭にシークされる
- [x] #5 同一ファイル内の区間トラック切替（再ロードなしのシーク）が従来どおり動作する
- [x] #6 トラックリストからの明示的なトラック選択では、一時停止中でも選択したトラックの再生が開始される
- [x] #7 再生開始/停止の決定が controller の状態機械側で宣言され、engine.load の無条件再生に依存していない
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. playerController.ts: withTrackIndex に intent (\"preserve\" | \"explicit\") を追加。
   - preserve (next/prev/audioEnded自動送り): status は変更しない。autoplay = 遷移前status が playing または loading。
   - explicit (trackSelected): status を loading に強制。autoplay は常に true。
   - startRequested は既存どおり常時 loading。loadTrack コマンドに autoplay:true を付与。
   - PlayerControllerCommand の loadTrack に autoplay: boolean フィールドを追加。
2. audioEngine.ts: load() の opts に autoplay:boolean を追加し、無条件 playAudio() をやめて autoplay 時のみ再生する。
3. useAudioEngineLifecycle.ts: coreState差分effect（139-209行）を削除し、同等のロード/シーク処理を loadTrack(item, autoplay) コールバックとして切り出す。coreStateパラメータ自体を不要にする。engine.load呼び出しに autoplay を渡す。cleanup管理用に refs.loadCleanup を追加（PlayerRuntimeRefs / PlayerRuntimeProvider）。
4. usePlayer.ts: subscribeCommands の case \"loadTrack\" を loadTrack(command.item, command.autoplay) 呼び出しへ接続。useAudioEngineLifecycle呼び出しから coreState を外す。
5. playerController.test.ts に新仕様のテストを追加（nextRequestedはpaused維持、trackSelectedはpaused中でも再生開始、loadTrackコマンドのautoplayフィールド検証）。
6. usePlayer.test.ts 等の既存テストが通ることを確認。派生問題（同一トラック再要求で先頭に戻らない）が新設計で解消されることを見る回帰テストを追加検討。
7. pnpm check / pnpm test を実行。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-07-30 仕様決定（ユーザー確認済み）: 一時停止中のトラック切替挙動は「操作で分ける」Spotify型を採用する。
- 次へ/前へボタン（nextTrack / prevTrack）: 再生状態を維持する。一時停止中なら切替後も一時停止のまま
- トラックリスト等からの明示的なトラック選択（setTrackIndex / 作品の再生要求）: 聴く意図の表明とみなし、一時停止中でも再生を開始する
どちらの場合も、再生/停止の決定は controller（状態機械）が宣言的に行い、engine.load() の無条件 playAudio() のような命令的副作用が状態を上書きする形は残さない。区間トラック切替（同一音源 reuse 経路）と別ファイル切替で挙動が変わる現状の非対称も、この仕様への統一で解消する。

派生問題の再現確認（コード解析ベース、着手前）:
useAudioEngineLifecycle.ts旧実装のロードeffectはdeps=[coreState.currentTrackIndex, coreState.tracks, coreState.currentWork]。
再生中の同一トラックに対して再度「最初から再生」（同一work参照・同一tracks配列参照・同一trackIndexでstartRequestedを発行）した場合:
- reducePlayer側は常にitem/positionSecを更新し新しいitemオブジェクトを返すが、toPlayerCoreStateが導出するcurrentTrackIndex/tracks/currentWorkの値そのものは不変。
- 再生中(playing/loading)→再度loadingの遷移ではisPlayingもtrue→trueで不変、他フィールドも不変のためisPlayerCoreStateEqualがtrueになりsetCoreStateすら呼ばれない。
- 結果、effectのdepsが変化せず再実行されないため、シーク（先頭復帰）が発生しない。派生問題は成立することを確認した。
- 対策: state差分effectをやめてcommand(loadTrack)駆動にすることで、dispatchのたびに無条件でロード処理が呼ばれる構造に変え、この非再現性を構造的に解消する。

実装完了。

変更ファイル:
- client/src/features/player/model/playerController.ts: withTrackIndex に intent("preserve"/"explicit")を追加。next/prev/audioEnded自動送りはpreserve（status維持、autoplayは遷移前playing/loadingのみtrue）、trackSelectedはexplicit（status強制loading、autoplay常時true）。startRequestedのloadTrackコマンドにautoplay:trueを付与。loadTrackコマンド型にautoplay: booleanを追加。
- client/src/features/player/model/audioEngine.ts: load()のoptsにautoplay: booleanを追加し、無条件playAudio()をやめてautoplay時のみ再生するよう変更。
- client/src/features/player/model/useAudioEngineLifecycle.ts: coreState差分effect（旧139-209行）を撤去し、loadTrack(item, autoplay)コールバックとして実ロード/シーク処理を切り出し。coreStateパラメータ自体を不要化。engine.load呼び出しにautoplayを渡し、クリーンアップはrefs.loadCleanupで管理（次ロード前/engine破棄時に呼ぶ）。
- client/src/features/player/model/playerRuntime.ts, PlayerRuntimeProvider.tsx: loadCleanup refを追加。
- client/src/features/player/model/usePlayer.ts: subscribeCommandsのcase "loadTrack"をloadTrack(command.item, command.autoplay)へ接続（従来はno-op）。useAudioEngineLifecycle呼び出しからcoreStateを除去。
- テスト追加/更新: tests/unit/playerController.test.ts（preserve/explicitのautoplay差分3件）、tests/unit/usePlayer.test.ts（一時停止中next→再開しない、一時停止中trackSelected→再生開始、同一トラック再要求→先頭シークの回帰テスト3件）、tests/unit/audioEngine.test.ts（autoplay:falseで再生しないテスト追加、既存テストにautoplay:true付与）。FakeAudioのsrcセッターにcurrentTime=0リセットを追加（実ブラウザのsrc再代入挙動を模した仕様修正、テスト精度向上のため）。

設計判断:
- 「再生意図」はコマンド(loadTrack.autoplay)に持たせ、controller(reducer)が状態遷移と同時に宣言的に決定する。useAudioEngineLifecycle側はautoplayフラグに従うだけの実行役に徹し、状態を自前判断しない（AC7）。
- 区間トラック再利用経路(reusesLoadedAsset)と別ファイルロード経路(engine.load)の両方でautoplay判定を統一（従来の非対称=coreState.isPlaying決め打ちを解消）。

破壊確認:
- withTrackIndexのautoplay計算を一時的に`const autoplay = true`に固定して意図判定を無効化。
- 結果、tests/unit/playerController.test.ts「一時停止中に次のトラックへ切り替えても一時停止のままで、再生を再開しない」が失敗:
  AssertionError: expected { type: 'loadTrack', …(2) } to match object { autoplay: false } (actual autoplay: true)
- tests/unit/usePlayer.test.ts「一時停止中に次のトラックへ切り替えても再生が再開しない（同一ファイルの区間切替）」も失敗:
  AssertionError: expected true to be false (isPlaying)
- 復元後、pnpm test 357件全通過を再確認。

pnpm check: 全通過（shared/server/client tsc, oxlint --deny-warnings, oxfmt --check）。
pnpm test (client): 54 files / 357 tests 全通過。

検証担当に見てほしい観点:
- ブラウザ実機で: 再生→一時停止→次のトラック で再生が再開しないこと（AC1）、再生中の次トラックは継続再生（AC2）、トラックリストからの明示選択は一時停止中でも再生開始（AC6）
- MediaSessionの次へ/前へボタンからの操作（useMediaSessionのonNextTrack/onPreviousTrack経由）でも同じくpreserve intentが効くこと
- resume復元（playWithResume）が従来どおり動作すること
- ABリピート設定中のトラック切替でAB区間がクリアされること（既存挙動、変更なし）

検証担当による確認完了。実機（区間トラック8本構成の実作品）で AC7件すべて合格: 停止中 next/prev で停止維持、再生中 next で継続、停止中の明示選択で再生開始、同一トラック再要求で先頭シーク（派生問題の解消を実機確認）、resume 復元も従来どおり。コードレビューで audioEnded 自動送り（wasPlaying=true→autoplay=true で継続）、loop（withTrackIndex 非経由の既存直接コマンド経路で影響なし）、playbackQueueEnded、Files モード引き継ぎ、loadCleanup のリーク経路なし、MediaSession next/prev が preserve intent に乗ることを確認。破壊テスト独立再実行: autoplay を true 固定にすると意図判定テスト2件が失敗（loadTrack autoplay:false 不一致 / isPlaying expected true to be false）、復元後全通過。FakeAudio の src 変更時 currentTime=0 リセットは HTML Living Standard の media element load algorithm と整合。pnpm check / pnpm test（server 344 / client 357）全通過。軽微な範囲外指摘: 末尾トラックで「次のトラック」ボタンが disabled にならない画面があった（既存UI仕様、no-opで実害なし）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
loadTrackコマンドを実ロード処理へ接続し、Spotify型仕様（next/prevは再生状態維持、明示選択は一時停止中でも再生開始）をcontroller側で宣言的に決定する設計に変更。engine.load()の無条件playAudio()を廃止しautoplayフラグ制御に統一。派生問題（同一トラック再要求で先頭に戻らない）はstate差分effectからcommand駆動への移行により構造的に解消。pnpm check/pnpm test全通過、破壊確認済み。ブラウザ実機確認は検証担当待ち。
<!-- SECTION:FINAL_SUMMARY:END -->
