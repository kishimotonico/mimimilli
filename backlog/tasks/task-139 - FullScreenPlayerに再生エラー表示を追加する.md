---
id: TASK-139
title: FullScreenPlayerに再生エラー表示を追加する
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 12:31'
updated_date: '2026-07-30 15:58'
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
- [x] #1 全画面表示中に再生エラーが起きた場合、エラー内容が全画面内に表示される
- [x] #2 エラー表示がBar/Popupと共通実装になっている
- [x] #3 pnpm check・pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bar/Popupのエラー表示を共通コンポーネントへ抽出
2. FullScreenPlayerに同表示を追加
3. pnpm --filter client check + pnpm test:client
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor(composer-2.5)で実装。PlaybackErrorNoticeを共通抽出しBar/Popup/FullScreenの3箇所で利用。client check + test:client 384件を統括側でも再実行し通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
再生エラー表示をPlaybackErrorNoticeへ共通化し、FullScreenPlayerにも配置。全画面中でもエラー内容が視認できる。
<!-- SECTION:FINAL_SUMMARY:END -->
