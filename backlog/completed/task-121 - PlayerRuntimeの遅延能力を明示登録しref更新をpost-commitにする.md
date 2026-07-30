---
id: TASK-121
title: PlayerRuntimeの遅延能力を明示登録しref更新をpost-commitにする
status: Done
assignee: []
created_date: '2026-07-28 16:26'
updated_date: '2026-07-28 17:52'
labels: []
dependencies:
  - TASK-120
priority: high
ordinal: 131000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-109 完了後の総合レビュー（Fable が検出、GPT-5.6-Sol が対処方針を精緻化）。

問題1: silent no-op（AGENTS.md の「過度なフォールバック禁止・問題を隠蔽しない」に抵触）
- usePlayer.ts の playWithResume は loadResumeRef.current が null なら黙って return
- seek は getCurrentPlaybackContextRef.current() が null なら黙って return（初期値は PlayerRuntimeProvider の () => null）

usePlayerActions は <PlayerRuntime /> がマウントされ usePlayerRuntime がレンダーされて初めて機能する。この配線が切れても（overlays から PlayerRuntime を外す、テストで入れ忘れる等）型検査もレンダーも通り、再生・レジューム・シークだけが黙って失敗する。通常フローでは踏まないが、防御が「たまたま踏まない」に依存している。

問題2: レンダー中の ref 代入が4箇所（usePlayer.ts）。StrictMode の二重レンダーでは冪等で無害だが、正攻法は post-commit での代入。

採用する方針（GPT-5.6-Sol 案、Fable も最終確認で同意）:
Provider が所有する小さな PlayerRuntimeCapabilities registry にする。PlayerController には持たせない。

controller へ寄せない理由:
controller は状態遷移とコマンド通知の境界であり、DB由来のレジューム処理や AudioEngine の実行能力まで持たせると責務が混ざる（サービスロケータ化の芽）。engine / loadedTrack / pendingResume など runtime 内部の可変状態は ref のままでよく、神クラス化しない。

非ブロッキングの追加検討（Fable 提案）:
lastVolume（ミュート前音量）は I/O のない純粋な状態遷移なので reducer 行きが自然。本タスクのついでに検討してよい。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PlayerRuntime をマウントせずに playWithResume / seek を呼ぶと、黙って失敗せず throw する
- [x] #2 未登録（配線バグ）と、登録済みだが再生対象がないため null（正常）が厳密に区別されている
- [x] #3 レンダー中の ref 代入が解消されている
- [x] #4 再生・レジューム・シーク・MediaSession が従来どおり動作する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. loadResume と getCurrentPlaybackContext を1組の capabilities として登録する仕組みを作る。登録先は Provider 所有の小さな registry（PlayerController には持たせない）
2. register(capabilities) は cleanup を返す
3. 未登録時の利用は開発環境限定ではなく常に throw する（dev限定 throw は AGENTS.md の「その場しのぎ」に該当するため不可）
4. 「未登録＝配線バグ＝throw」と「再生対象なし＝正常 no-op」を厳密に区別する。既存の if (!resume) return; は後者なので維持する
5. レンダー中の ref 代入4箇所を useLayoutEffect 等の post-commit へ移す
6. StrictMode の古い cleanup が新しい登録を解除しないよう、登録トークンか同一性ガードを設ける
7. engine / loadedTrack / pendingResume など runtime 内部の可変状態は現状の責務に残す
8. 任意: lastVolume を reducer へ移すことを検討する（非ブロッキング）
9. テスト: capabilities の未登録と「再生対象なし」を区別するテスト、StrictMode の登録・解除と stale cleanup のテスト
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
playerRuntimeCapabilities.ts を新設し、Provider が所有する registry で loadResume / getCurrentPlaybackContext を明示登録する形にした。PlayerController は無変更（capabilities を持たせない方針どおり）。

registry の設計:
- register(capabilities) は登録トークンを採番し cleanup を返す
- cleanup は registrationToken === token のときだけ解除する。StrictMode の setup→cleanup→setup で古い cleanup が新しい登録を消さない
- require() は未登録なら常に throw（dev 限定ではない）

「未登録」と「再生対象なし」の区別:
require() は登録の有無だけを見る。null は登録済み capabilities の戻り値として扱うため、playWithResume の if (!resume) return（レジューム対象なし）と seek の getCurrentPlaybackContext() null（再生中トラックなし）は従来どおり正常 no-op を維持している。

レンダー中 ref 代入4箇所の移動:
- runtimeRefs.coreState.current → useLayoutEffect
- loadResumeRef / getCurrentPlaybackContextRef → registry 登録（useLayoutEffect）へ置換
- runtimeRefs.updateMediaSessionPosition.current → useLayoutEffect

lastVolumeRef の reducer 移行は見送り。PlayerController の state / reducer / toggleMute / 既存テストの変更が必要でスコープを超えるため。必要なら別タスクとする。

検証:
- pnpm check 通過、pnpm test 通過（server 340 / client 328、テスト7件追加）
- ビジュアルテスト 6/6、スナップショット差分なし
- 意図的に壊した確認: 登録トークンのガードを外すと stale cleanup のテストが「capabilities are not registered」で失敗、require() の throw を silent return に戻すと未マウント時 throw のテストが「expected [Function] to throw an error」で失敗
- ブラウザ実機: レジューム再生（続きから・レジューム情報なしで先頭から・作品切替後）、シーク3経路、A-Bリピート、初回マウント直後の即操作と即再生、再生の基本動作、トラック自動進行と完走、MediaSession（playbackState と metadata の遷移）を確認
- 正常系 no-op の担保: ページ読込直後（currentWork なし）・一時停止中・最終トラック完走後のそれぞれでキーボード左右・シーク・A-B 操作を試し、例外が出ないことを確認
- コンソールのアプリ起因 error/warn は 0 件（除外は Vite HMR と React DevTools 案内のみ）
<!-- SECTION:NOTES:END -->
