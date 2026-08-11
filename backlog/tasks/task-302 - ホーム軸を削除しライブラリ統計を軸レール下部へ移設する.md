---
id: TASK-302
title: ホーム軸を削除しライブラリ統計を軸レール下部へ移設する
status: Done
assignee:
  - '@claude-sonnet'
created_date: '2026-08-11 09:51'
updated_date: '2026-08-11 10:20'
labels: []
dependencies: []
ordinal: 312000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DRAFT-52(ビュー軸再編)より。ホーム軸は実質使われていないため削除し、home軸専用の描画パスを他軸レイアウトへ一本化する。削除対象: LibraryView.tsxのisHome分岐(196-217行)、PreviewPaneのmode="home"とhomeStats prop、DiscoveryDashboard.tsx(丸ごと)、WorkCard.tsx(他に実参照が無いことを確認の上)、axisDefinitions.ts/resultsPane.ts/AxisColumn.tsx(HOME_AXIS)/navigationUrl.ts:87のhome参照。デフォルト軸は既にallなので変更不要。/library/homeは無効URLとしてallへフォールバックさせる(後方互換の維持はしない)。ライブラリ統計(X作品・Yトラック・合計時間、useLibraryQueries.ts:213のhomeStats)は軸レール(AxisColumn)最下部への常時表示に移設する。データ源のlibraryStatsQueryはScanModal(ScanModal.tsx:101,188)と共用のため残す。テスト: DiscoveryDashboard.test.tsxはファイルごと削除、libraryPresentation.test.ts/libraryNavigationActions.test.tsのhome関連ケースを削除・差し替え。smokeにhome依存なし。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 軸レールからホームが消え、/library/home を開くとデフォルト軸(すべての作品)で表示される
- [x] #2 どの軸でも作品未選択時は右ペインなしの既存レイアウトに一本化されている
- [x] #3 ライブラリ統計(作品数・トラック数・合計時間)が軸レール下部に常時表示される
- [x] #4 DiscoveryDashboardとhome分岐の残骸コードが削除されている
- [x] #5 pnpm test:smoke が通る
<!-- AC:END -->
