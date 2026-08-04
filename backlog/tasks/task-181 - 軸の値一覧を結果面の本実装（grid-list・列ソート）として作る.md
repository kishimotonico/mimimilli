---
id: TASK-181
title: 軸の値一覧を結果面の本実装（grid/list・列ソート）として作る
status: Done
assignee:
  - impl-181
created_date: '2026-08-03 14:45'
updated_date: '2026-08-04 12:15'
labels: []
dependencies:
  - TASK-178
  - TASK-180
priority: high
ordinal: 191000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0012 / DRAFT-50 のフェーズ3前半。TASK-180 で暫定表示にした値一覧を本実装に置き換える。

表示:
- grid: 代表カバー2×2コラージュタイル＋名前＋件数バッジ。タイルサイズは libraryTileSizeAtom に従う
- list: データ列型ハイブリッド行。左から 2×2コラージュ(32px) / 名前 / 件数 / 総時間。数値は tabular-nums で右揃え
- 代表カバーが4件に満たない値はコラージュの欠けたセルを背景色で埋める。0件なら軸のアイコンを置く
- 代表作品カバーの横並び帯は設けない。最終再生列も設けない

ソート（統括判断で確定済み）:
- 名前・件数・総時間の3キー。list では列見出しクリックで切り替え、昇降トグル。grid ではアドレスバーのソートメニューから選ぶ
- 列見出しとソートメニューは同一のソート状態への別入口であって独立した系にしない。アドレスバーのソートメニューは結果面が値一覧のときは 名前/件数/総時間、作品一覧のときは従来の作品ソート項目を出す単一系とする
- 名前ソートは表示名の単純比較にハードコードせず、値からソートキーを導く関数を注入できる形にする（将来の読み仮名メタデータ DRAFT-49 への伏線）

検索（統括判断で確定済み）:
- 値一覧ヘッダに絞り込み検索ボックスを置く。これは表示中の値リストに対するクライアント側の絞り込みで、librarySearchQueryAtom（全体検索・URL の q=）とは別 state。URL には載せず、軸切り替えでリセットする

値の数は数百〜千規模を想定するため、値一覧も仮想リスト化する（作品一覧と同じ @tanstack/react-virtual）。入れ子タグの階層表現は TASK-183 の担当で、本タスクではフルパスの平坦表示でよい。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 grid で値が代表カバー2×2コラージュ＋名前＋件数バッジのタイルとして並び、タイルサイズ設定が効く
- [x] #2 list で 2×2コラージュ(32px)/名前/件数/総時間 の列を持つ行として並び、件数と総時間が tabular-nums で右揃えになっている
- [x] #3 list の名前・件数・総時間の列見出しクリックでソートが切り替わり、再クリックで昇順降順が反転する
- [x] #4 名前ソートがソートキー導出関数の注入で差し替え可能な形になっており、既定実装が表示名比較であることをテストで検証している
- [x] #5 値一覧ヘッダの絞り込み検索が表示中の値だけを絞り込み、URL を変更せず、軸切り替えでリセットされる
- [x] #6 代表カバーが0〜3件の値でもコラージュが崩れず表示される
- [x] #7 値が1000件でも値一覧が仮想化によりスクロールで破綻しない
- [x] #8 値一覧の描画とソートの単体テストが追加され、pnpm check と pnpm test が通る
- [x] #9 ソートは UI が単一系・state が二重になっている。ソートメニューと列見出しは同一のソート状態への別入口だが、値一覧のソート状態と作品一覧のソート状態は別々に保持され、UI が結果面の内容に応じて接続先を切り替える。総時間ソート中に値を選択しても作品一覧が無効なソートキーを受け取らないことをテストで検証している
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装完了。

主な変更:
- AxisValueList.tsx を本実装に置き換え（grid/list・列ソート・仮想化・コンテキスト検索）
- 新規: AxisValueRows.tsx（list virtualizer + 列ソートヘッダー）、AxisValueGrid.tsx（grid virtualizer）、CoverCollage.tsx（2x2代表カバー、TASK-182と共有可能な形で分離）
- 新規: model/axisValueSort.ts（ソート状態・toggleAxisValueSort/selectAxisValueSortKey・ソートキー導出関数の注入対応）、model/axisValueFilter.ts（コンテキスト検索）
- atoms.ts に axisValueSortAtom を追加（sortAtomとは別state。ADR-0012帰結の二重state設計）
- LibrarySortMenu.tsx: 結果面が値一覧のときは名前/件数/総時間、作品一覧のときは従来のSORT_OPTIONSを出す単一系に変更。書き込み先atomを結果面種別で切り替える
- 入れ子タグの階層表現は本タスクの許容範囲内でスコープ外とし、タグ軸もフルパス平坦表示に統一（tagAxisGroupingは未使用のままTASK-183へ）

契約上のブロッカーと対応（統括へ事前共有済み）:
- e14e917 時点の AxisFacetItem.covers（{image,dimensions}のみ）はworkIdを持たず、カバー配信ルート（GET /media/cover/:id）がworkId必須のため描画不能だった
- shared/src/library.ts に axisFacetCoverSchema（coverValueSchema + workId）を追加し、covers要素の型を変更
- server/src/core/axisFacets.ts（fixtureアダプタ）と server/src/adapters/real/workRepo.ts（SQL covers_agg）の両方でworkIdを含めるよう修正

テスト:
- 新規: axisValueSort.test.ts, axisValueFilter.test.ts, AxisValueList.test.tsx を全面書き換え
- librarySortMenu.test.tsx に二重state検証テストを追加（AC#9）
- 既存グループ表示テスト（AxisValueList旧仕様のprefixグループ）は新実装で削除された挙動のため置き換え
- ビジュアルテスト: library.spec.ts の "tag filter chips" テストが .mll-tagrow 依存だったため .mll-vrow に更新して復旧

確認結果:
- pnpm check: shared/server/client tsc・lintは全通過。fmt:checkのみ他エージェント作業中の shared/src/work.ts で失敗（本タスク対象外、別タスクのWIP）
- pnpm test: server 448 pass / client 648 pass
- pnpm test:visual: 6件中3件（resume playback / tag editing / scan result dialog）が既知の障害のまま。新規失敗なし
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
軸の値一覧をgrid/list・列ソート・仮想化・コンテキスト検索を備えた本実装に置き換えた（ADR-0012 §5・§6・帰結）。
ソートは名前/件数/総時間の3キーで、UIは単一系（ソートメニューとlist列見出しが同じ axisValueSortAtom への別入口）・stateは作品一覧のsortAtomと別に二重保持。名前ソートは表示名比較をデフォルトにしつつソートキー導出関数を注入できる形にした（DRAFT-49伏線）。
実装の前提として、e14e917時点のAxisFacetItem.coversがworkIdを持たずカバー描画不能だった契約の抜けを発見・修正（shared/library.ts, server/core/axisFacets.ts, server/adapters/real/workRepo.ts）。統括へ事前共有済み。
検証: pnpm check（shared/server/client tsc・lint通過。fmt:checkは無関係な他タスクWIPファイルのみ失敗）、pnpm test（server 448 pass / client 648 pass、新規テスト多数追加）、pnpm test:visual（既知の3件のみ失敗、新規失敗なし。1件は.mll-tagrow→.mll-vrowのセレクタ更新で復旧）。
<!-- SECTION:FINAL_SUMMARY:END -->
