---
id: TASK-240
title: 'motion再導入(3/8): ライブラリ値選択UIの手動値退避を解消しAnimatePresenceへ移行する'
status: To Do
assignee: []
created_date: '2026-08-07 17:00'
updated_date: '2026-08-07 17:15'
labels: []
dependencies:
  - TASK-238
ordinal: 250000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
確定仕様は docs/adr/0014-motion-reintroduction-presence-removal.md の移行原則1〜3と軸切替の確定事項（フェーズ3・本命）。TASK-237で導入された手動値退避5ref（AxisQuickOverlay.lastResultRef / AxisValuePopoverPanel.lastResultRef / FilterChipAddButton.lastPickedAxisRef / AxisColumn.lastOverlayAxisRef / AxisColumn.lastAnchorElRef）を、条件レンダー境界化+APで削除する。クエリ購読は境界内側で常時有効引数に（useAxisFacetsQueryにenabled引数は無い点に注意）。useHoverGroupCoordinatorをトークン付き所有権APIへ変更（panelElRef・panelHandlers・document pointermoveをopenなownerのみに紐づけ、解除時はトークン一致確認）。フォーカス復帰はactiveElement検査後にreasonを渡す現行方式を維持し、useIsPresentはinertとリスナー解除のみに使う。AxisValuePopoverPanelの呼出元はFilterChipBandとFilterChipAddButtonの2箇所。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 名指しの退避ref5つがコードベースから消えている
- [ ] #2 オーバーレイ閉鎖(退出)中にfacet一覧が空にならない回帰テストがある
- [ ] #3 軸A→B高速切替で新パネルが閉じない・セーフトライアングルが壊れない・新パネルの検索欄フォーカスが奪われない(rapid reopenテスト)
- [ ] #4 useHoverGroupCoordinatorがトークン付き所有権APIになりユニットテストが更新されている
- [ ] #5 FilterChipBand.test.tsxの常時マウント前提モックが実コンポーネントテストに戻っている
- [ ] #6 pnpm check・変更範囲のテスト・pnpm test:smoke が通る
<!-- AC:END -->
