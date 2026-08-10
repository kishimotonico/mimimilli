---
id: TASK-297
title: プレイヤーに停止UIと音量の数値表示を追加する
status: To Do
assignee: []
created_date: '2026-08-10 19:00'
labels: []
dependencies: []
ordinal: 307000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
再生を中止してプレイヤーを閉じる手段がUIに無い。ロジック層のstop（client/src/features/player/model/usePlayerActions.ts:81-84 の stopRequested）は実装済みだが、どのUIからも呼ばれていない未接続状態。バー型（BarContent.tsx）・全画面型（FullScreenPlayer.tsx）に停止（×）ボタンを追加し、停止で playerIsActiveAtom（client/src/entities/player/model/atoms.ts:22-25）がfalseになりドックが非表示になること。あわせて音量スライダー（0〜100、BarVolumePopover.tsx:50-63 / FullScreenPlayer.tsx:201-213）に現在値の数値ラベルを常時表示する。ミュート機能は追加しない（BarVolumePopover.tsx:1-6 の既存設計判断を維持、ユーザーも不要と判断済み）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 バー型プレイヤーから再生を停止でき、プレイヤーが非表示になる
- [ ] #2 全画面プレイヤーからも停止できる
- [ ] #3 音量スライダーに0〜100の数値が表示される（バー型ポップオーバー・全画面とも）
- [ ] #4 pnpm test:smoke が通る
<!-- AC:END -->
