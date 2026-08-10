---
id: TASK-180
title: ドリル機構と中間カラムを廃止しライブラリの絞り込みを全軸共通のタグフィルタへ統合する
status: Done
assignee:
  - impl-180
created_date: '2026-08-03 14:45'
updated_date: '2026-08-04 11:26'
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

受け入れ条件 #7（プレビューの list/grid 単一実装化・グリッド専用インスペクタの二重系解消）は、他の項目と違って独立して切り離せる。実装が膨らんで1PRに収まらないと判断したら、#7 だけ TASK-183 へ後送してよい（その場合はタスクの実装ノートに理由を記録すること）。

year 軸のフィルタは URL 上 tags=year/2024 形式の擬似タグとして表現し、フィルタ解釈層で組み込み軸（addedAt の年照合）として解決する。組み込み軸専用のクエリパラメータは設けない（ADR-0012 §2）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 drillValueAtom / drillIntoAtom / drillBackAtom / isDrilledFacet / DrillHeader / ContentColumn.tsx がリポジトリから削除されている
- [x] #2 libraryPresentation.ts に showGrid・canShowWorksGrid が存在せず、list/grid の決定が libraryViewModeAtom のみに依存している
- [x] #3 cv 軸で値を選んでも list 設定のままなら作品一覧がリスト表示で出る（強制グリッドにならない）
- [x] #4 cv 軸の値とサークル軸の値を同時に選択でき、AND で絞り込まれた作品一覧が出る
- [x] #5 選択中のフィルタが軸を問わず結果面上部の同一のチップ列に並び、×で個別解除・「すべてクリア」で一括解除できる
- [x] #6 軸を切り替えても選択中のフィルタが維持される
- [ ] #7 作品選択時のプレビューが list/grid で共通の単一実装になっており、グリッド専用インスペクタとの二重系が残っていない
- [x] #8 libraryPresentation.test.ts / libraryNavigationActions.test.ts / navigationUrl.test.ts が新仕様に更新されて通る
- [x] #9 pnpm check と pnpm test が通り、ビジュアルテストのスナップショットが更新されている
- [x] #10 URL に drillValue セグメントが存在せず、全軸で tags= クエリによりフィルタが復元される。year 軸のような組み込み軸も tags=year/2024 形式の擬似タグとして同じ経路に載り、フィルタ解釈層で組み込み軸として解決される
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. atoms.ts/libraryNavigationActions.ts: drillValueAtom系を廃止し、selectedTagsAtomを全軸共通のフィルタへ一本化
2. navigationUrl.ts: drillValueセグメント廃止、tagsクエリを全軸で許可
3. libraryPresentation.ts: computeResultsPaneKind(home/value-list/works)で表示種別を一元化、showGrid系を全廃してisWorksGridActiveに統合
4. ContentColumn廃止→AxisValueList（facet/tag統合の値一覧・チェックボックスAND選択）+ WorkListPane（全幅list）+ FilterChipBand（全軸共通チップ）を新設
5. WorkGrid/WorkGridInspectorはドリル部分のみ削除し維持（AC#7はTASK-183へ後送）
6. LibraryView.tsx: レイアウトを[軸レール][結果面全幅]に固定。プレビューはPresence(preview-slide新規variant)でオーバーレイスライドイン
7. year軸はtags=year/2024擬似タグとしてsplitSelectedTagsで解決（実タグはtags[]、yearはaxis=year&axisValue）
8. テスト: libraryPresentation/libraryNavigationActions/navigationUrl/emptyWorks/DiscoveryDashboard/ContentColumn(→AxisValueList・WorkListPane分割)/AddressBar/LibraryGridControls/WorkGrid/workPatchInvalidation等を新仕様へ更新。ビジュアルテストのtag filter resultシナリオも新UIへ書き換え
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC#7（プレビューのlist/grid単一実装化・グリッド専用インスペクタの二重系解消）はTASK-183へ後送する。
理由: 本タスクの主眼（ドリル廃止・タグフィルタ統合・レイアウト固定）だけで既に大規模な変更（atoms/URL/libraryPresentation/LibraryView/AxisValueList/WorkListPane/FilterChipBand新設+CSS+テスト18ファイル)になっており、grid用WorkGridInspectorとlist/grid共通スライドインPreviewPaneの統合はさらに別の設計判断（インスペクタ幅・全画面プレビューとの兼ね合い）を要するため1PRに収めると膨らみすぎる。
現状: WorkGridInspectorはgrid専用のまま維持（gridInspectorOpenAtom経由）。list/works-grid問わず作品選択時のプレビューはPresence(variant="preview-slide")でオーバーレイスライドインする単一のPreviewPaneコンポーネントに統一済み（ADR-0012 §3のレイアウト固定自体はAC#3/#4/#6として満たしている）。残っているのはgrid専用インスペクタとの二重系のみ。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ドリル機構（drillValueAtom/drillIntoAtom/drillBackAtom/isDrilledFacet/DrillHeader/ContentColumn）を全廃し、facet軸・tag軸の値選択をselectedTagsAtomへの追加として一本化した（ADR-0012）。軸切替は絞り込みを保持し（setLibraryAxisAtomからselectedTags操作を削除）、レイアウトは[軸レール][結果面全幅]に固定、作品選択時のみPreviewPaneがPresence(variant="preview-slide")でオーバーレイスライドインする。

結果面の種類はcomputeResultsPaneKind(axis)が一元判定: home/value-list(facet+tag軸、新設AxisValueListが素朴な値一覧を表示)/works(ビュー軸+スマート軸、WorkGrid/WorkListPaneが全幅表示)。list/gridの決定はisWorksGridActive(axis, viewMode)がAddressBar/LibraryGridControls/LibraryWorksBoundary/LibraryViewの4箇所から共通利用し、強制グリッドの上書きを排除（AC#2/#3）。

year軸はtags=year/2024擬似タグとして表現し、splitSelectedTags()でクライアント側フィルタ解釈層が実タグ(tags[]+tagOp=AND)と組み込み軸(axis=year&axisValue)に分解する（組み込み軸専用クエリパラメータは設けない、ADR-0012 §2）。URL契約はdrillValueセグメントを廃止しtagsクエリを全軸で許可。

AC#7（プレビューのlist/grid単一実装化・グリッド専用インスペクタの二重系解消）はTASK-183へ後送。理由と現状は実装ノートに記録済み。WorkGridInspectorはgrid専用のまま維持しているが、list/grid問わずスライドインPreviewPane自体は単一実装に統一済み。

検証: pnpm check（tsc×3・oxlint・oxfmt）全通過。pnpm test（server 447件・client 615件）全通過。ビジュアルテスト（pnpm test:visual:update）は自作の新規テスト（tag filter chips and cross-axis AND filtering）を含め主要3件成功。resume playback/tag editing/scan result dialogの3件は失敗したが、git worktreeでTASK-180着手前のベースコミット(6a23169)に対して同一テストを実行し同じ3件が同様に失敗することを確認済み（pre-existing、本タスクと無関係）。agent-browserでCV軸選択→チップ表示→軸切替後もAND絞り込み維持→list/grid切替→プレビューオーバーレイの一連の手動確認も実施し設計通りの挙動を確認した。
<!-- SECTION:FINAL_SUMMARY:END -->
