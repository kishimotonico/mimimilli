---
id: TASK-277
title: library軸値一覧の重複パイプラインと軸定義の二重管理を解消する
status: To Do
assignee: []
created_date: '2026-08-08 21:21'
labels: []
dependencies: []
priority: medium
ordinal: 287000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出した library の axis-value 系の重複。
- AxisValueList.tsx:69-73 と AxisValueQuickList.tsx:150-154 で filterAxisValueItems → 階層化orソート → flatten の同一パイプライン → deriveAxisValueRows(items, query, sort) を model に抽出
- AxisColumn.tsx:28-35 と axisDefinitions.ts:12-21,73-83 でビュー軸の id/label/icon が二重定義 → axisDefinitions を正として buildViewAxisRows() を提供
- WorkGrid.tsx:144-153 と AxisValueGrid.tsx:70-79 の ResizeObserver 幅計測が同一実装 → useMeasuredElementWidth(ref) を shared hook 化（TASK-208 の仮想化共通土台と整合させる）
- クイックオーバーレイのローカルsort state（AxisValueQuickList.tsx:131）とメイン値一覧の axisValueSortAtom の不整合 → 同期するか独立仕様として明文化するかを決めて実装
- 同一階層インデントが 12px と 14px に分裂（AxisValueQuickList.tsx:31 / AxisValueRows.tsx:16）→ 定数統一
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 軸値の絞り込み・ソート・平坦化パイプラインが1実装になっていること
- [ ] #2 ビュー軸定義が axisDefinitions の1箇所になっていること
- [ ] #3 幅計測hookが共有化されていること
- [ ] #4 オーバーレイのソート仕様が決定・実装されていること
- [ ] #5 clientのcheck・変更範囲のテスト・smokeが通ること
<!-- AC:END -->
