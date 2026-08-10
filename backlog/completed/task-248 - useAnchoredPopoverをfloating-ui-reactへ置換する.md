---
id: TASK-248
title: useAnchoredPopoverを@floating-ui/reactへ置換する
status: Done
assignee: []
created_date: '2026-08-07 17:15'
updated_date: '2026-08-08 09:06'
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
- [x] #1 useAnchoredPopoverの位置計算・dismissalが@floating-ui/reactベースになりflip/shiftが効く
- [x] #2 既存9箇所の利用が退行なく動作しuseAnchoredPopover.test.tsxが移行されている
- [x] #3 フックがshared層へ移動しfeatures/library配下への逆依存が解消されている
- [x] #4 pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. @floating-ui/react を client へ追加
2. shared/ui/useAnchoredPopover.ts と shared/ui/usePopoverDismissal.ts を新設し、旧 features/library/ui/preview/useAnchoredPopover.ts を削除（re-export は残さない）
3. useFloating({ transform: false }) 必須。motion の popoverScale が同じ transform に scale を書くため衝突する
4. placement マッピング: below→bottom-start(absolute, offset6/flip/shift/size)、right→right-start(fixed, offset6/shift, flip なし)。getContainer は shift/size の boundary へ
5. layout を廃止し setReference/setFloating/floatingStyles/containerWidth を返す。autoUpdate で自前の RO/scroll 監視を撤去
6. AxisQuickOverlay の anchorRef 直接代入を elements.reference（referenceElement オプション）へ
7. dismissal は useDismiss へ一本化。boundaryRef/additionalBoundaryRefs は outsidePress コールバックで表現。close(reason) の伝播は維持
8. フォーカス復帰は自前ロジックを維持（FloatingFocusManager 禁止、ADR-0014 原則3）
9. below の top を CSS/Tailwind から offset(6) へ移す（.mll-qoverlay--inline / WorkMetadataActions / WorkTagEditor）
10. 呼び出し8箇所とテストを移行。位置の数値アサーションは追加しない
11. docs/design-system.md の useAnchoredPopover 記述を更新
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装はCursor、検証・レビューはSonnetサブエージェントに委任。コミット前レビューでフォーカス復帰の退行を1件検出し差し戻して修正した（referenceElement経路でreferenceRefがnullのままになりrefocusがno-opになる。AxisColumnのArrowRightで開いてEscapeで閉じるとフォーカスがbodyに落ちる）。あわせてflip()だけboundary未指定でビューポート基準だった不整合をコンテナ基準へ統一した。検証: pnpm check通過、pnpm test（server 505 / client 775）通過、pnpm test:smoke 10件通過。実機でArrowRight→Escape後のdocument.activeElementが軸行ボタンへ復帰することを実測確認。smokeのフレーキー1件はTASK-251として起票済み。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
useAnchoredPopoverを@floating-ui/reactへ置換しshared/uiへ移動した。belowにflip/shiftが効くようになり、位置計算・dismissalの二重管理とfeatures/libraryへの逆依存を解消した。motionのtransformとの衝突を避けるためtransform:falseを指定し、フォーカス復帰はADR-0014原則3のとおり自前ロジックを維持している。
<!-- SECTION:FINAL_SUMMARY:END -->
