---
id: TASK-109.4
title: プレイヤーcore stateの購読をプレイヤーUIへ分離する
status: Done
assignee: []
created_date: '2026-07-27 01:56'
updated_date: '2026-07-27 16:21'
labels: []
dependencies:
  - TASK-109.2
parent_task_id: TASK-109
priority: medium
ordinal: 117000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
usePlayer.ts:38 が playerCoreAtom を購読しており、App がこのフックを呼ぶため、音量・ループ・トラック切替・再生/一時停止のいずれでも App 以下が全部再実行される。currentTime / duration の高頻度 atom は既に分離済み（usePlayer 冒頭のコメント参照）だが、core state の購読位置は手当てされていない。

TASK-109.1 / 109.2 でライブラリ表示設定とナビゲーションを降ろしたあと、残る最大の再描画源がここになる。

方針:
- プレイヤーのランタイム（controller の生成・エンジンのライフサイクル・コマンド処理）と、core state を読む UI を分離する。ランタイム側は core state を購読せず ref / controller から読み、PlayerDock / FullScreenPlayer などの leaf UI が playerCoreAtom を購読する
- App が player の state を使っている箇所（isPlaying による padding-bottom 制御・TopBar の再生中表示・LeftNav の再生中カウント・FullScreenPlayer の表示条件）も、それぞれのコンポーネントで購読へ寄せる
- useSyncExternalStore への置き換えは目的ではない。購読位置の分離だけを行う
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 App.tsx が playerCoreAtom を直接・間接に購読していない
- [x] #2 音量変更・トラック切替・再生/一時停止で App が再レンダリングされない
- [x] #3 プレイヤーバー・ポップアップ・フルスクリーンプレイヤーの表示と操作が従来どおり動作する
- [x] #4 再生中のバー表示時のコンテンツ余白（has-docked-bar）が従来どおり効く
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. PlayerRuntimeProvider（context）を新設し、PlayerController インスタンスと lastVolumeRef 等の可変refを保持する。context value は不変にしてコンシューマを再描画させない
2. usePlayer を3分割する:
   - usePlayerRuntime(): エンジンのライフサイクル・コマンド購読・resume永続化・MediaSession。playerCoreAtom を購読するが、null を返す leaf コンポーネント <PlayerRuntime /> の中でだけ呼ぶ（App では呼ばない）
   - usePlayerActions(): context から controller を取り、dispatch ラッパーだけを返す。購読なし・参照安定
   - usePlayerState(): playerCoreAtom を購読する leaf UI 用
3. App が読んでいた player.state の各用途を購読側へ降ろす:
   - dockedBarActive → AppShell 側で購読
   - TopBar の isPlaying/playingTrack、LeftNav の playingCount → 各コンポーネントで購読
   - LibraryView / FilesView の playingWorkId/playingTrackIndex/isPlaybackActive → 各 feature 内で購読
   - PlayerDock / FullScreenPlayer → state と actions を自前で取得。FullScreenPlayer のマウント条件も player 側へ移す
   - handleShowPlayingWork → PlayerDock 側へ移設（navigation/library の action atom は setAtom なのでどこからでも呼べる）
   - useGlobalShortcuts → <PlayerRuntime /> 側へ移設
4. App に残る player 依存は再生開始の action のみ（handlePlay / handleResume / handlePlayFile）にする
5. 退行防止テスト: 音量変更・トラック切替・再生/一時停止で App が再レンダリングされないことを検証するテストを追加
6. pnpm check / pnpm test / ビジュアルテスト / agent-browser で手動確認
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
usePlayer を usePlayerRuntime / usePlayerActions / usePlayerState に3分割し、controller と可変refを PlayerRuntimeProvider（context）で共有する形にした。runtime は null を返す <PlayerRuntime /> の中でのみ動くため、core state を購読しても再描画コストが発生しない。

購読位置を降ろすだけでなく、atoms.ts に派生atomを追加して過剰購読も解消した（playerIsActiveAtom / playerIsPlaybackActiveAtom / playingWorkIdAtom / playingTrackIndexAtom / playingTrackTitleAtom / playingTrackRelPathAtom / dockedBarActiveAtom）。6箇所にコピーされていた isPlayerActive 判定もこれで一本化。

検証:
- pnpm check 通過、pnpm test 通過（server 340 / client 319、テスト6件追加）
- ビジュアルテスト 6/6、スナップショット差分なし
- 再描画実測（console.count 計装、確認後削除）: 音量変更で App / TopBar / LeftNav / AppShell / LibraryView いずれもログなし。陽性対照のトラック切替では TopBar と LibraryView が想定どおり再描画
- ブラウザ実機: 再生・シーク・バー⇄ポップアップ切替・ミュート復帰・ループ・再生速度・フルスクリーン展開/トラック選択/A-Bリピート・「再生中の作品を表示」・キーボードショートカット・ファイルモード再生とハイライト・has-docked-bar の付け外しを確認。コンソールエラーなし
<!-- SECTION:NOTES:END -->
