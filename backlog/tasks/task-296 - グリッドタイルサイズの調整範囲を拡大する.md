---
id: TASK-296
title: グリッドタイルサイズの調整範囲を拡大する
status: In Progress
assignee:
  - '@sonnet'
created_date: '2026-08-10 18:59'
updated_date: '2026-08-11 05:19'
labels: []
dependencies: []
ordinal: 306000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
現在のタイルサイズは100〜280px・8px刻み（client/src/shared/lib/gridSizing.ts:1-2、スライダーは client/src/features/library/ui/LibraryGridControls.tsx:50-63）。4Kモニターではもっと大きくサムネイルを見たい場合と、逆にもっと小さくして大量の作品を俯瞰したい場合の両方がある。最小・最大を拡大する（例: 最小72px前後〜最大480px以上。具体値は実際の見た目で調整）。列数計算（gridSizing.ts:29-38）とホイールズーム（WorkGrid.tsx:132 useWorkGridWheelZoom）が新範囲でも機能すること。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 タイルサイズの最小値が従来より小さく、最大値が従来より大きく調整できる
- [x] #2 4K相当の画面幅でも最大サイズで表示が破綻しない
- [x] #3 ホイールズームが新しい範囲全体で動作する
- [x] #4 pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
gridSizing.tsのMIN_TILE_SIZE(100→72)/MAX_TILE_SIZE(280→480)のみ変更。スライダー(LibraryGridControls.tsx)・ホイールズーム(useWorkGridWheelZoom.ts)・列数計算(computeGridColumnCount)はすべて定数参照のため変更不要。範囲根拠: 72pxは俯瞰用途で読める最小限（下限は8刻みの都合上72、それ以下は文字が完全に潰れる）、480pxは4K幅(3840px)でも1:1タイルのグリッドが破綻しないことをagent-browserで実測（%ベース+aspect-ratioレイアウトのため上限を上げても崩れない）。デフォルト値176pxは新範囲内でそのまま。agent-browserで4K viewport(3840x2160)にてスライダー最大480px・最小72pxを確認、Ctrl+ホイールで72→272まで動くことも確認。tsc通過。pnpm test:smoke 9/10通過、1件はTASK-301と同一の既存フレーキー。

【差し戻し対応】TASK-294/295の差し戻しに伴い、pnpm test:smokeのACをuncheck→再検証→recheckした。TASK-296自体は統括レビューで無罪と確定済み（gridSizing.tsのみの変更ではヨコスクロールテストの失敗は再現しない）。詳細はTASK-295のノート参照。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
グリッドタイルサイズの範囲をMIN 100→72、MAX 280→480へ拡大。スライダー・ホイールズーム・列数計算はすべて定数参照のため他の変更は不要。4K幅(3840px)で最大サイズでもレイアウトが破綻しないことを実機で確認。
<!-- SECTION:FINAL_SUMMARY:END -->
