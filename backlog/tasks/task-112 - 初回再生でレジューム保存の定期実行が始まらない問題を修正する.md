---
id: TASK-112
title: 初回再生でレジューム保存の定期実行が始まらない問題を修正する
status: Done
assignee: []
created_date: '2026-07-27 01:57'
updated_date: '2026-07-30 09:16'
labels:
  - client
  - player
  - bug
dependencies: []
priority: medium
ordinal: 120000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
コンポーネント設計レビュー（2026-07-27）で発見。コード上は確定、実機での再現確認は未実施。

usePlayer.ts:150 の 5秒間隔 persistTick の effect が、ガードと依存配列で異なる条件を見ている:
- ガード: controller.getState().status !== "playing" なら早期 return
- 依存配列: [controller, coreState.isPlaying, coreState.currentTrackIndex]
- playerController.ts:292 で isPlaying = (status === "playing" || status === "loading")

初回ロード時は status が loading の段階で isPlaying が false → true に変わって effect が走り、ガードで即 return する。その後 loading → playing へ遷移しても isPlaying は true のままで currentTrackIndex も変わらないため effect は再実行されず、interval が張られない。一度 pause / resume するまで5秒ごとのレジューム保存が始まらない。

修正の方向:
- ガードと依存配列の条件を揃える（status を直接見る派生値を coreState に持たせるか、controller の購読で扱う）
- 「isPlaying が loading を含む」という定義自体が誤解を招くので、命名や分割も検討する
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 初回再生の開始直後から5秒間隔のレジューム保存が動作する
- [x] #2 一時停止中はレジューム保存の定期実行が止まる
- [x] #3 ガードの条件と依存配列の条件が一致している
- [x] #4 再生位置の復元（続きから再生）が従来どおり動作する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. PlayerCoreStateにstatus: PlaybackStatusを追加し、toPlayerCoreStateとisPlayerCoreStateEqual比較関数を更新する
2. usePlayer.tsのpersistTick effectのガード・依存配列を両方coreState.status一本に統一する（controller.getState()の命令的参照をやめる）
3. isPlayingは既存の「loadingも再生中扱い」の意味のままUI各所で使い続ける。リネームはせずJSDocでstatusとの使い分けを明記するに留める
4. usePlayer.test.tsに「初回再生開始直後からpersistTickの5秒間隔が動作する」「一時停止中は止まる」のテストを追加。FakeAudioのplayイベント発火をqueueMicrotaskへ遅延させ、loading→playingのレンダー分離を再現できるようにする
5. 破壊確認（旧ガード/depsに戻して新テストが失敗することを確認）、pnpm check / pnpm testを実行
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
現状コードでの成立確認: TASK-110後もusePlayer.ts:144-148のガード(controller.getState().status !== "playing")とdeps([controller, coreState.isPlaying, coreState.currentTrackIndex])は別条件のまま。isPlaying(playerController.ts toPlayerCoreState)はstatus==="playing"||"loading"のためstartRequested(loading)の時点でfalse→trueに変わりeffectが走るがガードでreturn、その後loading→playingへ遷移してもisPlayingは変化せずeffect再実行なし→interval未設置。バグは現行コードでも再現することを確認。

設計: PlayerCoreStateにstatus: PlaybackStatusを追加(toPlayerCoreStateで反映、比較関数追加)。persistTick effectのガード・depsを両方coreState.status一本に統一(controller.getState()の命令的参照もやめてcoreStateを直接参照)。isPlaying自体はUI各所(再生/一時停止アイコン切替、MediaSession等)で「loadingも再生中扱い」という既存意味のまま広く使われているためリネームはせず維持、JSDocコメントで「status値そのものが必要な処理ではstatusを見ること」を明記するに留めた(過剰な分割・リネームはしない判断)。

破壊確認: 修正前のガード/depsに戻すと新規テスト「初回再生の開始直後（一時停止/再開なし）からpersistTickの5秒間隔が動作する」が失敗することを確認。
失敗メッセージ: AssertionError: expected "vi.fn()" to be called with arguments: [ 'work-1', {…(3)} ] / Number of calls: 0
(このテストはFakeAudioのplayイベント発火をqueueMicrotaskへ遅延させ、loading→playingを別コミットに分離することで実ブラウザのタイミングを模倣し、バグを再現できるようにした。同期発火のままだとloading/playingが1レンダーに畳み込まれ回帰を検出できなかった)

pnpm check / pnpm test: すべて成功（server 344 pass、client 359 pass、check全項目クリーン）

検証担当による確認完了。実機で AC4件合格: 初回再生直後から /resume POST が厳密に5秒間隔（timestamp実測）、一時停止で37秒間0件、再開で復帰、続きから再生の位置復元も正常。破壊テスト独立再実行: 旧実装（ガードとdepsの不一致）へ戻すと新規テストが Number of calls: 0 で失敗、復元確認済み。currentTrackIndex を deps から外した件はトラック切替時に persistResume(track-change) が即時発火するため周期タイマーの張り直し不要で、むしろ interval が途切れない改善と評価。FakeAudio の microtask 遅延は新規2テスト内の個別上書きのみでクラス定義は不変、既存テストへの影響なし。pnpm check / pnpm test（server 344 / client 359）全通過。なお検証過程で別の既存バグ（区間トラック再生中の明示選択で status が loading に固着し定期保存が停止する疑い）を発見、別タスクとして起票する。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
persistTick effect のガード（status !== playing）と依存配列（isPlaying / currentTrackIndex）の条件不一致により、初回再生では loading 段階で effect が走ってガードで return した後に再実行されず、pause/resume まで5秒間隔のレジューム保存が始まらなかった問題を修正。PlayerCoreState に status を追加してガードと deps を coreState.status 一本に統一し、isPlaying（loading を含む）との使い分けを JSDoc で明記。実機のネットワーク観測で初回再生直後からの5秒間隔保存・停止中の停止・再開後の復帰を確認。
<!-- SECTION:FINAL_SUMMARY:END -->
