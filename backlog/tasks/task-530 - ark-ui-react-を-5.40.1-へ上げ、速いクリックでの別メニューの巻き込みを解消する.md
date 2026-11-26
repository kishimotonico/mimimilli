---
id: TASK-530
title: '@ark-ui/react を 5.40.1 へ上げ、速いクリックでの別メニューの巻き込みを解消する'
status: To Do
assignee: []
created_date: '2026-11-26 06:35'
updated_date: '2026-11-26 08:19'
labels:
  - ui
dependencies: []
priority: medium
ordinal: 651000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
5.40.0（zag 1.47）は layer-stack の入れ子判定で、メニューAを開いたまま別メニューBのトリガーを素早く押すとBも閉じる。zag 1.49（Ark 5.40.1、2026-11-23 公開）で origins による親判定に変わり解消する。5.40.1 は 2026-11-30 以降に公開から7日を満たす。関連: ADR-0043、TASK-529.1
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 @ark-ui/react が 5.40.1 に厳密指定で上がっている（公開から7日以上）
- [ ] #2 メニューAを開いたまま別メニューBのトリガーを押して即離す操作で、Bが開いたまま残り BODY を経由しない（10回）
- [ ] #3 ADR-0043 の「5.40.0 は未対応」「メニューには finalFocusEl が無い」の記述が現状に合わせて書き換わり、useDialogModal の aria-labelledby 経由のトリガー解決を menu の finalFocusEl で置き換えられるか判断して反映されている
- [ ] #4 pnpm check && pnpm test と pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
速いクリックで B が閉じる記録: click 560ms → B expanded 572ms → B トリガー focusin 580ms → 598ms に A と B が同時に false。A の外側 pointerdown 処理が次フレームへ遅れ、A のレイヤー除去が後から開いた B を入れ子として巻き込む。5.40.1 で解消するかを同じ手順で確かめる
<!-- SECTION:NOTES:END -->
