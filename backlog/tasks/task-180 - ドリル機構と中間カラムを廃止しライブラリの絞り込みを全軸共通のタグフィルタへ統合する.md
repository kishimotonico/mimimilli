---
id: TASK-180
title: ドリル機構と中間カラムを廃止しライブラリの絞り込みを全軸共通のタグフィルタへ統合する
status: To Do
assignee: []
created_date: '2026-08-03 14:45'
labels: []
dependencies:
  - TASK-179
priority: high
ordinal: 190000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0012 / DRAFT-50 のフェーズ2。再設計の中核。ナビゲーション状態・表示設定・絞り込み状態が1本の分岐に混ざっている現状を分離する。

やること:
1. ドリル機構の廃止: drillValueAtom / drillIntoAtom / drillBackAtom / isDrilledFacet / DrillHeader を削除し、facet 軸の値選択を selectedTagsAtom への追加へ置き換える
2. 表示モード上書きの全廃: libraryPresentation.ts の showGrid・canShowWorksGrid を削除する。list/grid は常に libraryViewModeAtom に従う。showGrid は LibraryView.tsx:99 / LibraryWorksBoundary.tsx:110 / LibraryGridControls.tsx:24 / AddressBar.tsx:29 の4箇所で個別に再計算されているので全て潰す
3. レイアウトの固定: [軸レール][結果面（全幅）] とし、作品選択時のみプレビューがスライドインする。ContentColumn.tsx を削除し、作品一覧は list/grid どちらでも結果面全幅に出す
4. チップ列: 選択中フィルタを結果面上部のチップ列に軸を問わず同じ見た目で並べる。チップ×で個別解除、1件以上あるとき「すべてクリア」を表示。現行 ContentColumn 内の .mll-tagband を昇格させる形でよい
5. URL契約: /library/:axis/:drillValue の drillValue セグメントを廃止し、絞り込みは全軸で tags= クエリへ。navigationUrl.ts の「tags は tag 軸のみ許可」制約を外す
6. パンくずは「ライブラリ > 軸名」までとし、絞り込みはチップ列だけが表現する

本タスクの結果面は暫定でよい: 軸を選んだだけの状態の値一覧は、既存の FacetAxisContent / TagAxisContent 相当の素朴な一覧を全幅で出せば足りる。本実装は TASK-181 が担当する。オーバーレイ類も TASK-182 の担当で本タスクには含めない。

WorkGrid の inspector（gridInspectorOpenAtom）と PreviewPane の関係も整理する。レイアウトが固定される以上、作品選択時のプレビューは list/grid で共通の1つにまとめ、二重系を残さない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 drillValueAtom / drillIntoAtom / drillBackAtom / isDrilledFacet / DrillHeader / ContentColumn.tsx がリポジトリから削除されている
- [ ] #2 libraryPresentation.ts に showGrid・canShowWorksGrid が存在せず、list/grid の決定が libraryViewModeAtom のみに依存している
- [ ] #3 cv 軸で値を選んでも list 設定のままなら作品一覧がリスト表示で出る（強制グリッドにならない）
- [ ] #4 cv 軸の値とサークル軸の値を同時に選択でき、AND で絞り込まれた作品一覧が出る
- [ ] #5 選択中のフィルタが軸を問わず結果面上部の同一のチップ列に並び、×で個別解除・「すべてクリア」で一括解除できる
- [ ] #6 軸を切り替えても選択中のフィルタが維持される
- [ ] #7 URL に drillValue セグメントが存在せず、全軸で tags= クエリによりフィルタが復元される
- [ ] #8 作品選択時のプレビューが list/grid で共通の単一実装になっており、グリッド専用インスペクタとの二重系が残っていない
- [ ] #9 libraryPresentation.test.ts / libraryNavigationActions.test.ts / navigationUrl.test.ts が新仕様に更新されて通る
- [ ] #10 pnpm check と pnpm test が通り、ビジュアルテストのスナップショットが更新されている
<!-- AC:END -->
