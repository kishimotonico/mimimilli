---
id: TASK-229
title: セーフトライアングルの初回ホバー取りこぼしと退化三角形判定を修正する
status: To Do
assignee: []
created_date: '2026-08-07 09:26'
labels: []
dependencies: []
ordinal: 239000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-227のCodexレビューで見つかった2件を修正する。(1) client/src/features/library/ui/AxisColumn.tsx:86 で getTriggerHandlers(ax.id, rowRef.current) をレンダー中に評価しているため、初回レンダーでは rowRef.current が null のままハンドラに閉じ込められる。再レンダーが挟まらずに最初のホバーが起きると openKey だけ設定され openAnchorEl が null となり、AxisQuickOverlay が描画されない（!isOpen || !anchorEl で null を返すため）。event.currentTarget を使うか ref 自体を渡し、イベント発生時に要素を取得する。(2) client/src/shared/lib/pointInTriangle.ts:11-13 は3頂点が同一直線上にあり判定点も同じ直線上にあると外積が全て0になり true を返す（例 a=(0,0) b=(10,0) c=(20,0) p=(30,0)）。既存テストは面積0を直線外の点でしか検証しておらず素通りしていた。面積0を明示的に除外する
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 初回レンダー直後（再レンダーなし）の最初のホバーでもクイックオーバーレイが開く
- [ ] #2 getTriggerHandlers がイベント発生時のトリガー要素を取得する形になっている
- [ ] #3 isPointInTriangle が退化三角形（面積0）では判定点が同一直線上にあっても false を返す
- [ ] #4 上記2件の退行テストが追加され、修正前のコードでは赤くなることを確認済み
- [ ] #5 pnpm check と変更範囲のテストが通る
<!-- AC:END -->
