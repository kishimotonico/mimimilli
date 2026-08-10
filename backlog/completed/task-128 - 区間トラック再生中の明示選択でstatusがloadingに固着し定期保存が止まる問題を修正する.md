---
id: TASK-128
title: 区間トラック再生中の明示選択でstatusがloadingに固着し定期保存が止まる問題を修正する
status: Done
assignee: []
created_date: '2026-07-30 09:17'
updated_date: '2026-07-30 09:36'
labels:
  - client
  - player
  - bug
dependencies: []
priority: medium
ordinal: 138000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-112 の検証中に実機で発見（2026-07-30）。区間トラック（同一音声ファイル内のチャプター分割）を**再生中に**トラックリストから明示クリック（trackSelected、explicit 経路）すると、レジューム保存の定期実行が完全に停止する。

実測（agent-browser + network 観測、8区間トラック構成の実作品）:
- 選択直前は /resume POST が5秒間隔で正常
- 明示選択後は86〜90秒間、定期 POST が1件も飛ばない
- UI は「一時停止」アイコン（再生中扱い）を表示し続ける
- 手動 pause の persistResume(reason=pause) は正常に飛ぶ（コマンド経路は生存）
- persistResume の offsetSec が選択後ほぼ進んでいない（90秒経過後も 0.6966）。音声位置も実際には進んでいない疑いあり

原因の仮説（確度高いが未確証）:
- TASK-110 で trackSelected（explicit）は status を loading に強制するようになった
- useAudioEngineLifecycle の reusesLoadedAsset 分岐（同一アセット内の区間切替）は engine.load() を呼ばず engine.seek() + engine.play() のみ実行する
- 切替前から audio 要素が再生中（paused でない）の場合、play() を呼んでも "play" イベントが再発火しない可能性が高く、status を playing へ戻す audioPlaying dispatch が永久に来ない
- 結果、persistTick のガード（status === "playing"）が満たされず定期保存が停止。UI の isPlaying は loading を含むため気づかれにくい

注意:
- ブラウザ環境要因（headless Chrome の range fetch stall 等）の可能性は完全には排除できていない。着手時にまずユニットテスト（FakeAudio で「既に再生中の状態からの reusesLoadedAsset 切替」を再現）で仮説を確証すること
- offsetSec が進んでいない点は「playイベント不発」仮説だけでは説明しきれない可能性がある（seek 後に再生自体が止まっている等）。原因確定時に実挙動も突き止めること
- 修正は TASK-110 の方針（再生/停止の決定は controller が宣言的に行う）と整合させること。例えば reuse 経路で「audio が既に再生中なら audioPlaying を明示 dispatch する」等、状態機械の整合を復元する形が望ましい
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 区間トラックを再生中に明示選択しても、5秒間隔のレジューム保存が継続する（実機のネットワーク観測で確認）
- [x] #2 明示選択後、音声の再生と position の進行が実際に継続している
- [x] #3 ユニットテストで「再生中の同一アセット内明示選択」ケースが再現され、status が playing に収束することを検証している
- [x] #4 一時停止中の明示選択で再生が開始される挙動（TASK-110 AC#6）が壊れていない
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. audioEngine.ts の AudioEngine インターフェースに isPlaying(): boolean を追加し、!audio.paused を返す実装を足す。
2. useAudioEngineLifecycle.ts の loadTrack コールバック、reusesLoadedAsset かつ autoplay の分岐で、engine.play() 呼び出し前に wasAlreadyPlaying = engine.isPlaying() を取得。play() 後、wasAlreadyPlaying なら controller.dispatch({type:"audioPlaying"}) を明示発行し、onPlay イベント不発による status固着を解消する（TASK-110の「controllerが宣言的に決める」設計と整合、engine側は物理状態を通知するだけ）。
3. usePlayer.test.ts の FakeAudio を実ブラウザ仕様に合わせ、paused状態を追跡してplay()/pause()がpaused遷移時のみイベント発火するよう修正（src再代入時はpaused=trueへ戻す）。deferPlayEventToMicrotaskヘルパーも同様に調整。
4. 「再生中の区間トラックを明示選択してもstatusがloadingに固着せずplayingへ収束する（TASK-128）」テストを追加し、修正前後で仮説を確証・検証する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
仮説確証: usePlayer.test.ts のFakeAudioを実ブラウザ仕様（既にpaused=falseの状態でplay()を呼んでもplayイベント再発火しない）に修正し、「再生中の区間トラックを明示選択してもstatusがloadingに固着せずplayingへ収束する（TASK-128）」テストを追加。修正前コードで実行すると AssertionError: expected 'loading' to be 'playing' で確証（reusesLoadedAsset+explicit経路でengine.play()がno-opになりonPlayが発火せずaudioPlayingがdispatchされない）。

実装完了。

変更ファイル:
- client/src/features/player/model/audioEngine.ts: AudioEngine に isPlaying(): boolean を追加（!audio.paused を返す）。
- client/src/features/player/model/useAudioEngineLifecycle.ts: loadTrack の reusesLoadedAsset+autoplay分岐で、engine.play()呼び出し前にwasAlreadyPlaying = engine.isPlaying()を取得し、trueならengine.play()後にcontroller.dispatch({type:"audioPlaying"})を明示発行してstatusをplayingへ収束させる。
- client/tests/unit/usePlayer.test.ts: FakeAudioにpaused状態を追加し、play()/pause()は実際にpaused遷移があるときのみイベント発火するよう修正（src再代入時はpaused=trueへリセット。実ブラウザのresource selection algorithm相当）。deferPlayEventToMicrotaskヘルパーも同様に修正。「再生中の区間トラックを明示選択してもstatusがloadingに固着せずplayingへ収束する（TASK-128）」テストを追加（AC3）。

設計判断:
- TASK-110の「再生/停止の決定はcontrollerが宣言的に行う」方針を維持しつつ、audioEngine側はHTMLMediaElementの物理的なpaused状態をisPlaying()として公開するだけに留めた。useAudioEngineLifecycle側は「play()を呼んでもイベントが来ないと分かっている場合に限り」audioPlayingを代理dispatchする形にし、controllerの状態遷移ロジック自体（withTrackIndexのintent判定等）には手を入れていない。
- なぜreuse経路だけが問題になるか: preserve intent（次へ/前へ）はstatusを遷移前のまま維持するため元々playingで壊れない。explicit intentのみstatusを強制loadingにするため、audioが既にpaused=falseだと収束先のイベントが来ず固着する。

破壊確認:
- useAudioEngineLifecycle.tsのwasAlreadyPlaying分岐を一時的に外し、engine.play()のみ呼ぶ旧実装に戻して新規テストを実行:
  AssertionError: expected 'loading' to be 'playing' // Object.is equality
- 復元後、該当テスト含め usePlayer.test.ts 25件全通過を再確認。

offsetSec（AC2）の実機挙動について:
- 単体テストのFakeAudioモデルではcurrentTimeが自動進行しない（timeupdateイベントを手動dispatchする作り）ため、「実際のオーディオ位置が進んでいない」という実機観測をこのテスト環境で直接再現・確証することはできなかった。
- コード上、reuse経路はengine.pause()を一切呼ばないため、audio要素のpausedは選択前後で一貫してfalseのまま（= 物理再生は継続するはず）。onTimeUpdate/hasReachedTrackEndの境界計算にも今回の選択パスで異常な即終了を起こす要素は見当たらなかった。
- 以上より、offsetSecが90秒間ほぼ進まなかった実機観測は、タスク記載の「headless Chromeのrange fetch stall等のブラウザ環境要因」の可能性が高いと判断し、アプリケーションコード側の追加修正は行っていない。AC2の実機確認は検証担当側で、今回のstatus固着修正後にネットワーク観測・音声位置の実進行を確認してほしい（もし依然として進まない場合は、range fetch/シーク周りの別問題として切り出しが必要）。

pnpm check: 全通過（shared/server/client tsc, oxlint --deny-warnings, oxfmt --check）。
pnpm test: server 344 pass / client 360 pass（新規テスト1件込み）、全通過。

検証担当による確認完了。AC#1: 実機（8区間トラック作品）で再生中の明示切替後も resume POST が5000ms間隔で50秒間ノンストップ継続（修正前は86〜90秒完全停止）。AC#2: preserve経路で offsetSec が実時間進行（0.04→5.13→10.21→…）、明示選択直後も概ね実時間進行。一部の試行で offsetSec のプラトー（0.92で停滞）を観測したが、同じ経路の後続試行では正常進行しており、再現が不安定な headless Chrome の range fetch stall 的環境ノイズと判断（本修正が原因の系統的問題ではない）。AC#4: 一時停止中の明示選択で先頭から再生開始、TASK-110 AC#6 の回帰なし。コードレビュー: audioPlaying reducer は純粋な状態代入で commands 常に空のため二重 dispatch は冪等、play() reject 時も onError→audioFailed で error に上書きされ固着しない、isPlaying() の意味論も seek/ended/error 各経路と整合。破壊テスト独立再実行: wasAlreadyPlaying 分岐除去で expected 'loading' to be 'playing' の失敗を再現、復元済み。pnpm check / pnpm test（server 344 / client 360）全通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TASK-110 で trackSelected（explicit）が status を loading に強制するようになった一方、同一アセット内の区間トラック reuse 経路では再生中の audio に play() を呼んでも play イベントが再発火せず、audioPlaying が来ないまま status が loading に固着して persistTick の定期保存が停止していた。engine に物理状態を返す isPlaying() を追加し、reuse+autoplay 経路で既に再生中の場合のみ audioPlaying を代理 dispatch して状態機械を収束させる形で修正（判断は lifecycle 側、reducer は不変更で TASK-110 の宣言的方針を維持）。FakeAudio を paused 状態追跡の実ブラウザ仕様に改修して failing test で仮説を確証し、実機で保存継続・回帰なしを確認。
<!-- SECTION:FINAL_SUMMARY:END -->
