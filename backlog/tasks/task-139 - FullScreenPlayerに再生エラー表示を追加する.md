---
id: TASK-139
title: FullScreenPlayerに再生エラー表示を追加する
status: To Do
assignee: []
created_date: '2026-07-30 12:31'
labels: []
dependencies: []
priority: low
ordinal: 149000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BarContent.tsx:31,60-63 と PopupContent.tsx:68,181-184 は playbackError を formatPlaybackError() で表示するが、client/src/features/player/ui/FullScreenPlayer.tsx:49-50 だけ playbackError を取得せず、エラー表示UIが無い。全画面はモーダル（top layer）で背面のバー/ポップアップを覆うため、全画面中に再生エラー（トラック自動送り失敗等、playerController.ts:344 の error遷移）が起きるとユーザーは原因を確認できない。

方向: エラー表示（+可能なら再試行導線）をBar/Popupと共通のコンポーネントに切り出してFullScreenPlayerにも配置する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 全画面表示中に再生エラーが起きた場合、エラー内容が全画面内に表示される
- [ ] #2 エラー表示がBar/Popupと共通実装になっている
- [ ] #3 pnpm check・pnpm test が通る
<!-- AC:END -->
