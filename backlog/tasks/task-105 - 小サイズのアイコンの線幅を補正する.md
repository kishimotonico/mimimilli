---
id: TASK-105
title: 小サイズのアイコンの線幅を補正する
status: Done
assignee:
  - '@cursor'
created_date: '2026-07-26 14:35'
updated_date: '2026-07-26 14:41'
labels: []
dependencies: []
ordinal: 109000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
アイコンの実効線幅は 1.5 × size / 24 で決まるため、13px以下では1pxを下回りサブピクセル描画で灰色に溶ける。9px表示で0.56px、13pxで0.81px。実測で chev・chevD・refresh が9〜13pxで判別困難だった(自作時代から同じ状態)。size指定は13px以下が40箇所と14px以上より多いため影響範囲が広い。アダプタ層で strokeWidth をサイズの逆数でスケールし、実効線幅が1pxを下回らないようにする。塗り表現のアイコンは stroke がシルエットを膨らませるため対象外。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 outline系アイコンの実効線幅が9〜13pxで1px以上になる
- [x] #2 16px以上では従来の stroke 1.5 が維持される
- [x] #3 塗り表現のアイコン(play・pause・prev・next・starF・gridJustified)のシルエットが変わらない
- [x] #4 自作で残した製品固有アイコンも同じ補正を受ける
- [x] #5 9・10・12・13px の主要画面で目視確認し、判別できることを確認済み
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Icon.tsx に strokeFor(size) = Math.max(1.5, 24 / size) を追加する
2. lucideIcon と Svg(塗りでない場合)と ratio11 の strokeWidth をこれに差し替える
3. lucideIconFilled と塗り指定の Svg は 1.5 のまま(シルエットを膨らませないため)
4. pnpm check と pnpm test を通す
5. 統括担当が9〜13pxで目視確認する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Math.max(1.5, 24 / size) で実装(4771e5a)。canvasで実サイズにラスタライズして8倍拡大し補正前後を比較。chev/chevD/X/Check/Plus/Search が明確に改善。Cog と TriangleAlert は9〜10pxで内部が埋まり気味だが、cogの実使用は14〜20px、errは11px以上なので実害なし。
<!-- SECTION:NOTES:END -->
