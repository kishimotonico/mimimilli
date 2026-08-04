---
id: TASK-187
title: 値一覧の件数・総時間を現在の絞り込みを反映した値にする
status: In Progress
assignee:
  - impl-184
created_date: '2026-08-04 12:23'
updated_date: '2026-08-04 13:38'
labels: []
dependencies: []
priority: medium
ordinal: 197000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
実機検証（2026-08-04）で見つかった未定義事項。統括判断でファセット件数方式に確定する。

現状、cv/霧島レイ で絞り込んでいる状態でサークル軸の値一覧を見ても、各サークルの件数・総時間はフィルタ非適用の全体値（月白製作所5件など）が表示される。そのため、実際には0件しかヒットしない値でも大きな件数が表示され、選ぶと0件という結果になりうる。

再設計で軸をまたいだ複合絞り込みが主要な操作になった以上、値一覧の数値は「いま選ぶと何件になるか」を表すべき。一般的なファセット検索の慣行とも一致し、0件の値を選んでしまう空振りを防げる。

したがって GET /axes/:axis に現在のフィルタ（tags[] と組み込み軸のフィルタ）を渡し、絞り込み後の集合に対する件数・総時間・代表カバーを返すようにする。フィルタ適用後に0件になる値の扱い（一覧から消すか、0件として残すか）も決める必要がある。統括判断: 0件の値は一覧から除外する（選べない値を並べても選択の役に立たないため）。ただし現在選択中の値は、自分自身で絞り込まれて0件に見えても必ず残す。

パフォーマンスへの影響に注意すること。TASK-178 の実測では1000値規模で17〜24ms だったが、フィルタ条件が加わると変わる。実測して記録すること。

対象: shared の軸ファセット取得の契約 / server/src/routes/axes.ts / server/src/core/axisFacets.ts / server/src/adapters/real/workRepo.ts の getAxisFacets / client の軸ファセット取得クエリとキャッシュキー

## 集計方式の確定（レビュー反映 2026-08-04）

当初「全フィルタを適用したAND件数」としていたが、それだと主要ユースケースの同軸乗り換えで一覧が壊れる。cv/霧島レイ を選択中にCV軸の値一覧を見ると、他のCVの件数が「霧島レイとの共演作品数」になり、ほぼ全値0件になる。0件除外と組み合わさるとCV一覧が選択中の値と稀な共演者だけに潰れる。加えて通常クリックの既定は置き換え（TASK-186）なので、表示される数値が既定操作の結果と一致しない。

したがって自軸除外カウント（multi-select facet の標準慣行）を採る。軸Xの値一覧は「現在のフィルタから軸X由来のフィルタを除外した集合」に対して集計する。これにより同軸の数値が置き換え後の実結果と一致し、他軸フィルタによる空振り防止という本来の目的も達成される。「現在選択中の値は特別に残す」という例外規定は不要になる（自軸除外なら選択中の値も普通の件数で残る）。

キャッシュキーには「軸 + 自軸除外後のフィルタ集合」を使うこと。AND追加時の結果件数（共演数）を見せたい要望は、将来ホバー時のツールチップ等で補う。一覧の主数値にはしない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 フィルタが変わるとクエリキーが変わり、キャッシュが正しく分離される
- [x] #2 real と fixture の両アダプタが同一の契約で動き、契約テストが通る
- [x] #3 1000値規模でフィルタ有無それぞれの応答時間を実測し、タスクの実装ノートに記録している
- [x] #4 pnpm check と pnpm test が通る
- [x] #5 軸Xの値一覧の件数・総時間は、現在のフィルタから軸X由来のフィルタを除外した集合に対して集計される（自軸除外カウント）
- [x] #6 同軸の値を乗り換えるとき、表示される件数が置き換え後の実際の結果件数と一致する
- [x] #7 他軸のフィルタ（サークル・year 等）は適用されたまま集計される
- [x] #8 代表カバーも同じ自軸除外後の集合から選ばれる
- [x] #9 自軸除外後に0件になる値は一覧から除外される
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装: 自軸除外カウント方式（統括判断・レビュー反映版）。shared に axisFacetsQuerySchema（tags/tagOp/axis/axisValue）を追加し、GET /axes/:axis がこれを受ける。core/axisFacets.ts の buildAxisFacets(axis, works, filter?) が filterByTags/filterByAxis（worksQuery.ts、TASK-185で export 済み）で集計対象を先に絞り込む。real側は workRepo.ts に queryWorks と共通の WorkRepo.tagAxisConditions(tags, tagOp, axis, axisValue) を切り出し、getAxisFacets の3分岐（year/tag/prefix）すべてにEXISTS述語を追加。自軸除外（selectedTagsからaxisOfFilterTag(tag)===axisのものを除く）はclient側のbuildAxisFacetFilterParams（libraryPresentation.ts）が担い、サーバーは渡されたtags/axisをそのままAND条件として使うだけ（サーバーは「自軸」を知らない）。

クエリキー: WORK_QUERY_KEYS.facets(axis, filterParams) にfilterParamsを含め、useAxisFacetsQuery（AxisValueList本体・クイックオーバーレイ・チップドロップダウンが共有するフック）経由で自動的にキャッシュ分離される。

実測（1000値規模、TASK-178と同じ形状: distinctなcv値1000×5件/値=works 5000件、covers付与3分の2）。WorkRepo.getAxisFacets を10回計測（in-memory SQLite、ローカル環境）:
- フィルタ無し（従来と同一クエリ形状、ベースライン）: min 8.19ms / avg 8.96ms / max 11.03ms
- tags AND 1件のEXISTS追加: min 9.76ms / avg 10.13ms / max 10.56ms
- axis=year（addedAtのsubstr比較、EXISTS無し）: min 6.50ms / avg 6.80ms / max 7.22ms
- tags AND + axis=year 併用: min 9.24ms / avg 9.63ms / max 10.06ms
再実行でも同水準を確認（8.37/9.10/11.44、9.77/10.37/10.99、6.12/6.51/7.54、9.20/9.79/10.28）。フィルタ追加によるオーバーヘッドは+1〜2ms程度で、1000値規模でも実用上問題ない水準。ベンチスクリプトはTASK-178と同じ方針でリポジトリに残していない（一時ファイル）。

契約テスト: server/tests/real/worksQueryContract.test.ts に「軸ファセットの絞り込み...もreal SQLとcoreが同値」を追加し、tag/year/cv/サークル/気分/シリーズ の6軸 × 6種のfilter組み合わせでreal⇔fixture(core)の同値を確認。server/tests/tagPrefixes.test.ts に buildAxisFacets のfilter単体テスト（AND絞り込み・axis=year・0件除外・filter省略時の回帰確認）を追加。server/tests/app.test.ts にルートレベルのクエリパース（tags配列・tagOp・axis・axisValue のadapterへの受け渡し、省略時の既定値）を追加。client側は libraryPresentation.test.ts に buildAxisFacetFilterParams の単体テスト、api.test.ts に getAxisFacets のクエリ組み立てテスト、新規 useAxisFacetsQuery.test.ts に自軸除外・クエリキー分離（フィルタ変更で再フェッチ）のフック統合テストを追加。
<!-- SECTION:NOTES:END -->
