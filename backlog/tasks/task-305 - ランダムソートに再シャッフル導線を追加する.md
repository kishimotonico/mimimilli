---
id: TASK-305
title: ランダムソートに再シャッフル導線を追加する
status: Done
assignee:
  - '@claude-sonnet'
created_date: '2026-08-11 09:52'
updated_date: '2026-08-11 10:43'
labels: []
dependencies:
  - TASK-302
ordinal: 315000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DRAFT-52(ビュー軸再編)より。ソートのランダムはシード付きで正しく実装済み(server/src/core/worksQuery.tsのstableRandomSortKey、ページング中は同一シードで安定)。ホーム削除(TASK-302)でDiscoveryDashboardの「ランダムピック+再シャッフルボタン」が消えるため、メイン一覧のソートに代替導線を入れる。現状クライアントはseedを発行せず、サーバー発行のseedをReact QueryのpageParamで引き継ぐだけ(client/src/features/library/model/useLibraryQueries.ts:90-97,123,152)。実装方針: navigationAtoms(client/src/entities/library/model/navigationAtoms.ts)にrandomSeedAtomを新設してqueryKeyに含め、sort=randomのときLibrarySortMenu(client/src/features/library/ui/LibrarySortMenu.tsx)付近にrefreshアイコンの再シャッフルボタンを表示、押下で新seedを発行して再取得する。UXはDiscoveryDashboard.tsx:102-109の再生成ボタン(IconButton icon=refresh)を踏襲。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ソートがランダムのとき再シャッフルボタンが表示され、押すと並びが変わる
- [x] #2 検索・タグ絞り込みと組み合わせてもランダム表示と再シャッフルが機能する
- [x] #3 ページング(無限スクロール)中は並びが安定し、再シャッフルまで変わらない
- [x] #4 ソートをランダム以外に変えるとボタンが消える
- [x] #5 pnpm test:smoke が通る
<!-- AC:END -->
