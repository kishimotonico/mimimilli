---
id: TASK-248
title: useAnchoredPopoverを@floating-ui/reactへ置換する
status: To Do
assignee: []
created_date: '2026-08-07 17:15'
labels: []
dependencies:
  - TASK-240
ordinal: 258000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ライブラリ積極導入方針に基づく置換。client/src/features/library/ui/preview/useAnchoredPopover.ts(329行)は placement 2種(below/right)のみ・flip/shiftなし・focus trapなしの自前実装で、9箇所以上が依存する。@floating-ui/react の useFloating/flip/shift/size/useDismiss へ置き換え、配置の硬直とdismissal散在を解消する。注意: motion移行のTASK-240(フェーズ3)が同じファイル群の境界を条件レンダーへ作り変えるため、必ずその完了後に着手する（先行すると二重改修になる）。置換時はフックの置き場所をshared層へ移す（現在features/library配下だがplayer/filesからもimportされている）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 useAnchoredPopoverの位置計算・dismissalが@floating-ui/reactベースになりflip/shiftが効く
- [ ] #2 既存9箇所の利用が退行なく動作しuseAnchoredPopover.test.tsxが移行されている
- [ ] #3 フックがshared層へ移動しfeatures/library配下への逆依存が解消されている
- [ ] #4 pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->
