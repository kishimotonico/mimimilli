---
id: TASK-109.4
title: プレイヤーcore stateの購読をプレイヤーUIへ分離する
status: To Do
assignee: []
created_date: '2026-07-27 01:56'
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
- [ ] #1 App.tsx が playerCoreAtom を直接・間接に購読していない
- [ ] #2 音量変更・トラック切替・再生/一時停止で App が再レンダリングされない
- [ ] #3 プレイヤーバー・ポップアップ・フルスクリーンプレイヤーの表示と操作が従来どおり動作する
- [ ] #4 再生中のバー表示時のコンテンツ余白（has-docked-bar）が従来どおり効く
<!-- AC:END -->
