---
id: TASK-296
title: グリッドタイルサイズの調整範囲を拡大する
status: To Do
assignee: []
created_date: '2026-08-10 18:59'
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
- [ ] #1 タイルサイズの最小値が従来より小さく、最大値が従来より大きく調整できる
- [ ] #2 4K相当の画面幅でも最大サイズで表示が破綻しない
- [ ] #3 ホイールズームが新しい範囲全体で動作する
- [ ] #4 pnpm test:smoke が通る
<!-- AC:END -->
