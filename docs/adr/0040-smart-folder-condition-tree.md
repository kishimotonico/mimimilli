# ADR-0040: ライブラリのビューをスマートフォルダーに一本化し、条件の木で評価する

- ステータス: 承認
- 日付: 2026-11-22
- 関連: [ADR-0005](0005-tags-as-sole-attribute.md)（§3 を本ADRで改訂）、[ADR-0008](0008-persistence-topology-query-ownership-playback-ids.md)（core↔SQL の例外表を本ADRで改訂）、[ADR-0012](0012-library-axis-as-value-browse.md)（決定1・2を本ADRで改訂）、[ADR-0016](0016-view-axis-consolidation.md)（ビュー軸を本ADRで置き換え）、[ADR-0026](0026-value-list-as-global-entry.md)（3文を撤回し、値一覧の件数の意味を改訂。値一覧でチップと検索語を効かせない前提は ADR-0041 で廃止）、[ADR-0041](0041-library-sidebar-shell-navigation.md)（画面・URL・履歴）、[design-system.md](../design-system.md)（見送り案「軸レールの各軸に件数を出す」を本ADRで撤回）、backlog DRAFT-50

## 文脈

ライブラリの左側には、ビュー（`all`・`recent`・`added`・`fav`・`error`）、軸表示を ON にした prefix の分類軸、スマートフォルダーの3種類が並んでいる。見た目は同じ列の行だが、評価の経路は3本ある。

| 経路                    | core（fixture）                                   | real                                                                            |
| ----------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| ビュー                  | `filterByView`（`server/src/core/worksQuery.ts`） | `viewConditions`（`server/src/adapters/real/workQuerySql.ts`）                  |
| 通常検索（q・tags・年） | `applyWorksQuery`                                 | `queryWorks`（`workQueryRepository.ts`）                                        |
| スマートフォルダー      | `evalSmartFolder`（`core/smartFolder.ts`）        | SQL で候補を OR 抽出し、全件読み込んで core で最終評価（`smartFolderWorks.ts`） |

値一覧の集計も、通常の `getAxisFacets` とスマートフォルダー表示中だけの `getSmartFolderAxisFacets` の2本がある。経路ごとに受け取る条件が少しずつ違い、検索語が効く経路と効かない経路がある。

スマートフォルダーのルールは接続詞つきの直列チェーン（`WHERE`・`AND`・`OR`・`AND NOT`）で、条件はタグと長さの2種類しか書けない。「お気に入り」や「最近再生」は条件としては書けず、ビューの switch の中にしかない。CV別・サークル別は prefix 定義の `show_as_axis` から作られる別の仕組みで、ユーザーが足したり消したりする対象になっていない。

core と SQL は別々に `Date.now()` を呼んでいて（`core/worksQuery.ts`・`workQuerySql.ts`）、「30日以内に追加」の境界が両者でずれうる。

## 決定

### ビューと分類軸をなくし、すべてスマートフォルダーにする

ビューと分類軸の仕組みをなくし、ライブラリの行はすべてスマートフォルダー（保存された検索）にする。「すべて」「お気に入り」も、CV別・サークル別も、スマートフォルダーの1つである。CV別のような分け方は「グループ分け」を持つスマートフォルダーとして表し、消すのも足すのも自由にする。

`tag_prefixes.show_as_axis` と設定画面の軸表示トグルはなくなる。新しい prefix を定義しても、スマートフォルダーは自動では足さない（グループ分けの選択肢には出る）。

お気に入りは当面 `work_states.bookmarked` のまま使い、`bookmarked` 述語で参照する。

内部名は `SmartFolder`・`smart_folders`・`/api/smart-folders` のまま変えない。`/api/folders` のような短縮はファイルモードの物理フォルダーと紛れるので採らない。画面には総称を出さない（呼び方は [ADR-0041](0041-library-sidebar-shell-navigation.md)）。次の段階で足す「手で入れるリスト」は、catalog の `playlists` と衝突するので、内部名はその段階で決める。

### 条件の木

スマートフォルダーの条件は、論理演算と述語からなる木で表す。判別キーは `type`。

```ts
type Condition =
  | { type: "and"; children: Condition[] } // [] は全作品
  | { type: "or"; children: Condition[] }
  | { type: "not"; child: Condition }
  | { type: "tag"; tag: string }
  | { type: "hasPrefix"; prefix: string }
  | { type: "duration"; op: "gte" | "lte"; sec: number }
  | { type: "bookmarked" }
  | { type: "played"; withinDays?: number }
  | { type: "added"; withinDays: number }
  | { type: "addedYear"; year: string }
  | { type: "hasError" }
  | { type: "text"; q: string };
```

否定は述語ごとに持たず、`not` で組む。「タグを含まない」は `not(tag)`、「cv のタグがない」は `not(hasPrefix)` になる。

評価する側（core と SQL）は一般の再帰として実装する。保存できる形だけを次のように絞る。

- ルートは常に `and`。子が1つでもルートの `and` は畳まない
- ルート直下の子は、述語、`not(述語)`、述語だけを子に持つ `or`（いずれかに一致）、その否定の `not(or)`（どれにも一致しない）のどれか。入れ子はこの1段まで
- 子の無い `or` は保存できない（弾く）
- 1つの `and`・`or` の子は100個までにする。SQL は子を平坦につなぐので、SQLite の式の深さの上限（1000）に届く木を保存させない
- 入れ子が1段より深い木や子の多すぎる木は、例外や 500 ではなく 400 で返す

保存時（作成・更新）に正規化する。

- 子が1つの `or` は畳む（`or([x])` → `x`、`not(or([x]))` → `not(x)`）。畳むのはルートの内側だけ
- 同じ親の中の重複した子は落とす。重複かどうかは、オブジェクトのキー順を無視した構造の一致で決める。タグの正規化（prefix の小文字化・trim）は既存の `tagSchema` に任せる
- まとまり（`or`・`not(or)`）はまとまりごと外す。まとまりの中の子だけを外す操作は持たず、空の `or` は残らない

「お気に入りの案内を出す」「エラーの一括解除バナーを出す」のように画面が条件の意味を知りたいときは、ID ではなく条件の形で判定する（ルートの子が `bookmarked` だけ、`hasError` だけ、など）。判定は shared の関数1つにまとめ、空状態・バナー・件数の色・アイコンが同じものを呼ぶ。この判定は上の正規化を前提にする。スキャンの要対応からエラーの一覧へ移る導線（backlog DRAFT-70）も、`error` の ID ではなく条件が `hasError` だけのスマートフォルダーを探す。見つからないときの扱いは DRAFT-70 で決める。

`condition_json` に版は持たない。述語を足しても保存済みの行には影響しない。述語を変える・消すときは user migration で JSON を書き換える。

### 述語の意味

不明な値に対して何を返すかを含め、各述語の意味を次の表に固定する。core と SQL はこの表に従い、契約テストはこの表の境界を必ず踏む。

| 述語         | 真になる作品                                                                                | 値が不明な作品   | 例                                                |
| ------------ | ------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------- |
| `tag`        | そのタグを持つ（完全一致。[ADR-0005](0005-tags-as-sole-attribute.md)）                      | なし             | 癒し を含む                                       |
| `hasPrefix`  | その prefix のタグを1つ以上持つ                                                             | なし             | `not(hasPrefix("cv"))` で「未整理」               |
| `duration`   | 合計時間が `sec` 以上（`gte`）・以下（`lte`）                                               | 長さ不明は常に偽 | `not(duration lte 3600)` には長さ不明の作品が入る |
| `bookmarked` | お気に入りである                                                                            | なし             | お気に入り                                        |
| `played`     | `withinDays` 省略時は再生したことがある。指定時は基準時刻から `withinDays` 日以内に再生した | 未再生は偽       | `not(played)` で「未再生」                        |
| `added`      | 基準時刻から `withinDays` 日以内に追加した                                                  | なし             | 30日以内に追加                                    |
| `addedYear`  | 追加日時の年が `year`                                                                       | なし             | 2025年に追加                                      |
| `hasError`   | 状態が `ok` でない（missing と error の両方）                                               | なし             | エラー                                            |
| `text`       | 作品検索と同じ部分一致                                                                      | なし             | タイトルに「雨」を含む                            |

- `not(x)` は `x` が偽の作品すべてを返す。値が不明で偽になった作品も含む。三値論理は使わない
- 期間の基準時刻 `now` は評価コンテキストとして受け取る。`createMatcher(condition, { now })` と `compileCondition(condition, { now })` が同じ値を受け、どちらも自分で `Date.now()` を呼ばない。`now` は route が1リクエストにつき1回作ってアダプタへ渡す。テストは固定時刻で回す
- SQL では各葉（述語）が必ず 0 か 1 を返し、その上に `NOT`・`AND`・`OR` を組む。述語ごとの気配りに任せず、葉のコンパイルの出口で `CASE WHEN … THEN 1 ELSE 0 END` に包む。木全体の出口で包むのでは足りない。長さ不明の作品に対する `NOT (duration <= 3600)` が NULL のまま最後に 0 になり、意味表と逆になるからである。0/1 にしておけば件数も合計で数えられる

### 評価の所有権

アダプタ（fixture・real）の口は条件の木だけを受ける。

- `queryWorks({ condition, ids?, sort, seed, page, limit }, { now })`
- `groupWorks({ condition, groupBy, groupSort }, { now })`（グループ分けの値一覧と「＋絞り込み」の候補。`groupSort` の順で返す）
- `countByConditions(conditions, { now })`（件数）

スマートフォルダーの ID、`view`、`tags`・`tagOp`・`q` はアダプタに渡さない。`ids`（スキャン記録の絞り込み）は保存されない一時的な集合なので、述語にせず別の引数で残す。

チップは常に AND で効く。チップの OR（`tagOp`）は廃止し、HTTP 契約からも外す。OR を送ってきたリクエストは受け付けない（黙って AND として扱わない）。OR は保存した条件の `or` で表す。

スマートフォルダーの条件・選択中のグループの値・チップ・検索語から1本の木を作るのは、shared の `buildEffectiveCondition` 1か所にする。サーバーの評価と、クライアントの「検索を保存」「上書き」が同じ関数を通る。

```
effective = and(
  スマートフォルダーの条件の子,
  グループの値があればその述語（prefix → tag(prefix/値)、タグ → tag(値)、追加年 → addedYear(値)）,
  チップ（擬似タグ @year/2025 は addedYear に写す）,
  検索語があれば text(q),
)
```

擬似タグ `@year/…` を `addedYear` に写すのはこの関数の中だけにする（クライアントは `splitSelectedTags` で分解してから渡す）。route はスマートフォルダーを引いてこの関数を通し、アダプタへ渡すだけで、検索規則を持たない（[ADR-0008](0008-persistence-topology-query-ownership-playback-ids.md) の route の規則を保つ）。

API の `sort` は必須にし、サーバーは「省略時はスマートフォルダーの並び」を解決しない。並びの解決はクライアントが行う（後述）。

ランダムの `seed` はクライアントだけが発行する。`sort=random` で `seed` が無いリクエストは 4xx にする。サーバーが seed を発行してレスポンスで返す仕組み（今の `core/worksQuery.ts`・`core/smartFolder.ts`・`workQueryRepository.ts` の3か所）はなくす。

fixture は core の `createMatcher` だけを、real は `compileCondition` を `queryWorks` の WHERE に入れる形だけを使う。fixture がインメモリで core を呼ぶ以上、core と SQL の二重実装は残る。一致は契約テストで縛り、テストは「同じ木を両方に渡し、順序付きの作品 ID 列・`total`・グループの値と件数・件数を比べる」1つの形式にする。木の生成器は上の意味表の境界（長さ不明、未再生、基準時刻ちょうど、`not` の下の不明な値）を必ず含める。

### ADR-0008 の例外表の改訂

ADR-0008 の「core↔SQL二重実装の統制」を次のように改める。

- 「作品検索」の例外は、条件の木の評価を含む。`queryWorks`・`groupWorks`・`countByConditions` はすべて `compileCondition` を通し、core 側の対応は `createMatcher` と `queryWorksByCondition`
- 「軸ファセット集計」の例外は、スマートフォルダーの条件をかけたグループの値一覧（`groupWorks`）に置き換わる
- 「規範形は `evalSmartFolderRules`」の文、「スマートフォルダーは二重実装ではない」の段落、SQL で候補を減らしてから純粋関数で最終評価する2段階評価、ルール無しのスマートフォルダーの別経路の記述は、いずれも成り立たなくなる。2段階評価は使わない
- 作品検索の内訳のうち `RECENT_VIEW_WINDOW_DAYS` による recent view の期間判定はなくなり、`added`・`played` 述語と評価コンテキストの `now` に置き換わる
- `random` の seed の「最初の要求でサーバーが seed を発行する場合もレスポンスで返す」契約はなくなる。seed はクライアントが必ず送り、無ければ 4xx（seed なしのランダム順を返さない原則は変えない）

例外を増やす条件（性能上の必要と契約テスト）は変えない。

### グループ分け

グループ分けは、スマートフォルダーの条件をかけた作品を値ごとに分けて見せる。

```ts
type GroupBy =
  | { kind: "prefix"; prefix: string } // cv/〇〇 → 値「〇〇」
  | { kind: "tag" } // タグ
  | { kind: "addedYear" };
```

- グループ分けを持つスマートフォルダーは、値を選ぶ前は値の一覧、値を選ぶとその値の作品一覧になる
- 値の件数・総時間・代表カバーは、スマートフォルダーの条件をかけた後の集合から数える
- 値のラベルは今と同じく `tag_prefixes` の label を引く。prefix 定義を消してもスマートフォルダーは壊れない（prefix はただの文字列として残る）
- 値の並び（`group_sort`）はグループ分けを持つスマートフォルダーの定義の一部で、値一覧に効く。作品一覧の並び（`sort`）は、値を選んだ後の作品一覧に効く（次節）
- 値一覧は値ごとに件数・総時間・最近追加・最近再生・読み（`sortKey`）を返し、最近追加は作品の `added_at` の最大、最近再生は `last_played_at` の最大（1件も再生していなければ null）とする。`sortKey` は追加年なら年、タグなら `tags.search_key`、prefix なら `tags.value_sort_key`（どれも ADR-0008 の日本語ソートキー）
- prefix の値は最初の `/` より後ろ全体を1つの値として扱う（`hoge/fuga/piyo` の prefix `hoge` の値は `fuga/piyo` で、階層には分けない）。階層の見せ方は client の見出し（名前順のときだけ）の仕事で、サーバーの集計は階層を前提にしない

### 並び順

並び順は、作品一覧の並びと値一覧の並びの2つがあり、作品一覧の並びは「既定の並び」と「今の並び」の2層に分ける。

- 既定の並びはスマートフォルダーの定義の一部で、`sort` 列に持つ。`sort` は null にでき、null は「『すべて』と同じ」を表す。「すべて」だけは null にできない
- 今の並びは画面で一時的に変えた並びで、保存しない（持ち方は [ADR-0041](0041-library-sidebar-shell-navigation.md)）
- 実際に使う並びは「今の並び → スマートフォルダーの既定の並び → 『すべて』の既定の並び」の順に解決する。解決はクライアントが行い、API には解決済みの `sort` を渡す

「すべて」の既定の並びを変えると、「『すべて』と同じ」のスマートフォルダー全部に効く。

値一覧の並びは `group_sort` に持つ。グループ分けがあるときだけ必須で、ないときは null。「すべて」からの継承は無い（「すべて」はグループ分けを持たない）。値は向き込みの次の8種で、作品の並びの ID と同じ流儀（`<キー>-<向き>`、最近再生は `last-played`）で付ける。

| ID                              | 意味                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `count-desc`・`count-asc`       | 件数の多い順・少ない順                                                                                   |
| `name-asc`・`name-desc`         | 名前（読み）の昇順・降順。追加年のグループ分けでは、画面の文言を「年（古い順）」「年（新しい順）」にする |
| `duration-desc`・`duration-asc` | 総時間の長い順・短い順                                                                                   |
| `added-desc`                    | 最近追加した順（値ごとの最新の追加日時が新しい順）                                                       |
| `last-played`                   | 最近再生した順（値ごとの最新の再生日時が新しい順。再生のない値は末尾）                                   |

同順位は `sortKey`、さらに値の順（どちらも UTF-8 バイト順の昇順）で決める。名前の降順はこの2つを両方とも逆順にする。core と SQL は同じ並びを返し、契約テストで縛る。

### 既定のスマートフォルダー

shared にテンプレートを持ち、起動時の初期化で入れる。テンプレートは13本、最初に入れるのは11本。

| ID                                            | 名前                                 | 条件                 | 既定の並び       | グループ分け                                                 | 値の並び                   |
| --------------------------------------------- | ------------------------------------ | -------------------- | ---------------- | ------------------------------------------------------------ | -------------------------- |
| `all`                                         | すべて                               | なし                 | 追加日           | なし                                                         | なし                       |
| `random`                                      | ランダム                             | なし                 | ランダム         | なし                                                         | なし                       |
| `recent`                                      | 最近再生                             | `played`（期間なし） | 最終再生         | なし                                                         | なし                       |
| `added`                                       | 最近追加                             | `added(30)`          | 追加日           | なし                                                         | なし                       |
| `fav`                                         | お気に入り                           | `bookmarked`         | 「すべて」と同じ | なし                                                         | なし                       |
| `error`                                       | エラー                               | `hasError`           | 「すべて」と同じ | なし                                                         | なし                       |
| `by-cv`・`by-circle`・`by-category`・`by-tag` | CV別・サークル別・カテゴリ別・タグ別 | なし                 | 「すべて」と同じ | `cv`・`サークル`・`カテゴリ` の prefix、タグ                 | 件数の多い順               |
| `by-year`                                     | 追加年別                             | なし                 | 「すべて」と同じ | 追加年                                                       | 名前の降順（新しい年が先） |
| `by-series`                                   | シリーズ別                           | なし                 | タイトルの昇順   | `シリーズ` の prefix（最初は入れず、「既定から追加」で足す） | 件数の多い順               |
| `by-rating`                                   | レーティング別                       | なし                 | 「すべて」と同じ | `rating` の prefix（最初は入れず、「既定から追加」で足す）   | 件数の多い順               |

- 起動時の初期化は1か所にまとめ、fixture も同じ関数を通す。「すべて」の行が無ければテンプレートから入れる。「すべて」が無い状態を扱うコードは書かない
- 残りの既定は `app_settings` の `smart_folders_seeded`（user に分類する）を立てて1回だけ入れる。全部消しても戻さない。`tag_prefixes_seeded` と同じやり方
- 「非表示」は持たない。要らないものは削除する。消した既定は「既定から追加」で戻す。候補はテンプレートの固定 ID のうち今ない ID で、`templateKey` のような列は作らない
- ユーザーが作るものの ID は今と同じ `sf-<uuid>`
- 0件のときも行は隠さない。「エラー」も常に出す

テンプレートは初期データと「既定から追加」の元でしかない。入れたあとの既定のスマートフォルダーは自作のものと同じに扱い、名前・条件・グループ分け・既定の並び・値の並び・位置を変えられ、削除もできる。

特別なのは「すべて」だけで、次の形を保つ。

- 条件は空の `and`、グループ分けと値の並びは null
- 名前は「すべて」のまま変えない
- 既定の並びは null（「『すべて』と同じ」）にできない
- 削除できない

「すべて」で変えられるのは既定の並びと位置だけになる（位置は並べ替え API で動かす）。

ID で扱いを分けるのは「すべて」だけである。アイコンも ID からは引かない。グループ分けを持つものはグループ分けから、持たないものは条件の形から引く（ルートの子が `bookmarked` だけ、`hasError` だけ、など）。条件が空のものは「すべて」と同じアイコンにし、既定の並びがランダムのときだけランダムのアイコンにする。既定のスマートフォルダーの条件やグループ分けを変えると、アイコンも新しい形に見合ったものになる。お気に入りの案内やエラーのバナーのように条件の意味で決まるものも、前に書いたとおり条件の形で判定する。

### 保存先

`smart_folders` を作り直す。

```
smart_folders(id TEXT PK, name TEXT, condition_json TEXT, sort TEXT NULL,
              group_by_json TEXT NULL, group_sort TEXT NULL, position INTEGER, created_at TEXT)
```

- `group_by_json` と `group_sort` は、どちらも null か、どちらも値を持つかのどちらか
- 並び順は `position` の整数で持ち、並べ替えは全件の順序を送る PUT にする。スマートフォルダーは多くても数十本
- 書き込むのは検証済みの API だけなので、読み出しも保存と同じスキーマ1本で厳密に読む。読み出し用の緩いスキーマは持たない。述語や並びの ID を変えるときは、user migration で保存済みの JSON を書き換える（前述）
- 読めない行は正常な状態として扱わない。読めない行が1つでもあれば、一覧の取得は失敗させ、応答とログに行の ID と直し方を出す。画面は一覧の取得失敗として扱い、読めない行専用の画面や型を持たない。直し方は行を消すコマンドを示す（消した「すべて」は次の起動の初期化で戻る）

```sh
# Linux
sqlite3 "${XDG_DATA_HOME:-$HOME/.local/share}/mimimilli/db/user.sqlite" "DELETE FROM smart_folders WHERE id = '<id>'"
# Windows、cmd
sqlite3 "%LOCALAPPDATA%\mimimilli\db\user.sqlite" "DELETE FROM smart_folders WHERE id = '<id>'"
```

- サイドバー用の別テーブル（`sidebar_items` のようなもの）は作らない

### 件数

件数は、条件が空でなく、グループ分けを持たないスマートフォルダーだけを `countByConditions` で1往復で数える。空のライブラリでは0を返す。

- 件数は SQL の値で、読めない作品は数に含まれる
- 条件が空のもの（すべて・ランダム）とグループ分けを持つものには件数を出さない。「最近再生」には出す
- 条件が `hasError` だけのものは件数を赤い丸で出し、0件のときは件数を出さない（行は出す）
- 件数は定義と別に取る（後述の HTTP の契約）。作品の状態が変わったとき（再生の開始、お気に入りの切り替え、登録解除など）は件数だけを取り直し、定義の一覧は取り直さない
- 再生を始めたときは、開いている一覧の並びも動かさない。「最近再生」を開いて再生した作品が、その場で先頭へ動くことはない
- 再生を始めたときはグループの値一覧を取り直さない。開いている値一覧を動かさないことを優先する。お気に入りの切り替えは、`bookmarked` を条件にしたグループ分けの値の集合を変えるので、値一覧も取り直す
- 1クエリで合計するか、スマートフォルダーごとに数えるか、`hasPrefix` のために tags へ prefix の派生列を足すか、件数の細かい無効化をするかは、30k ベンチで必要が見えてから決める

[design-system.md](../design-system.md) の見送り案「軸レールの各軸に件数を出す」は撤回する。見送りの理由のうち「値の個数か作品数か区別できない」はグループ分けのスマートフォルダーに件数を出さないことで、「全件集計が走る」は1往復の集計とベンチで答える。

### HTTP の契約

アダプタの口の外側（`/api/smart-folders` 以下）を次の形にする。読み取りは GET、本文の要求型は shared に置き、client と server が同じ型を通す。

| 口                              | 役目                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `GET /smart-folders`            | 定義の一覧。件数は含めない                                                   |
| `GET /smart-folders/counts`     | 件数（`Record<id, number>`）。数えるものはサーバーが shared の判定関数で選ぶ |
| `POST /smart-folders`           | 作成。通常の作成・既定から追加・削除の取り消しのすべてがこの口を通る         |
| `PATCH /smart-folders/:id`      | 部分更新。送った列だけを更新する                                             |
| `DELETE /smart-folders/:id`     | 削除。すぐ行う                                                               |
| `PUT /smart-folders/order`      | 並べ替え。全件の ID の順を送る                                               |
| `GET /smart-folders/:id/works`  | 作品一覧                                                                     |
| `GET /smart-folders/:id/groups` | グループの値一覧と「＋絞り込み」の候補                                       |

- 作成: 本文は名前・条件・既定の並び・グループ分け・値の並びと、任意の `id`・`position`。`id` を省くと `sf-<uuid>` を採番し、末尾に入れる。既定から追加はテンプレートの固定 ID と定義を、削除の取り消しは消した行の ID・位置・定義を送る。履歴に残った `/library/<id>` が、戻したあとも同じ行を指すようにするためである。`id` は `sf-<uuid>` の形かテンプレートの固定 ID に限り、すでにある ID なら 409。`position` を渡したときはその位置に入れ、後ろをずらす。作成日時は作り直した時刻になる
- 更新: 本文は `{ name?, condition?, sort?, groupBy?, groupSort? }` で、1つ以上を持つ。送らなかった列は触らないので、検索の上書き（`{ condition, sort? }`）、既定の並びの保存（`{ sort }`）、値の並びの保存（`{ groupSort }`）が、ほかの列を巻き戻さない。同じ列の同時の更新は後勝ちにする
- 更新後の行の検証は shared の関数1つで行う。見るのはデータの不変条件だけで、条件が保存できる形か、`groupBy` と `groupSort` の組が合うか、「すべて」の形（前述）が保たれるかである。違反は 400。ID や既定かどうかによる 403 は持たない。無い ID は 404
- 件数: 件数を出す行だけを数える。定義を変える操作の応答は行だけを返し、件数を数え直さない
- 値一覧と「＋絞り込み」の候補: 同じ口で扱う。スマートフォルダー＋グループの値＋チップ＋検索語から組んだ条件と、任意の `groupBy` を受ける。`groupBy` はクエリの1文字列（`prefix:cv`・`tag`・`addedYear`）で渡す。省くとそのスマートフォルダー自身のグループ分けで値一覧を返し、渡すとその分け方で候補を返す。`groupSort` は必須で、サーバーは既定を補わない（クライアントが保存済みか今の並びを渡す）。応答の各値は `value`・`sortKey`・`lastAddedAt`・`lastPlayedAt`・`count`・`durationSec`・`covers`
- チップ（`tags`）は100個までにする。超えたら 400。条件の子の上限（前述）と同じく、SQLite の式の深さの上限に届かせないため
- スキャン記録の絞り込み: 作品一覧の口が `scanRecord`（`new`・`updated`）と `scanChange` を受け、サーバーが記録から作品の ID 集合を引いてアダプタの `ids` に渡す。ライブラリ全体の件数・統計、スキャン画面の新規作品・更新済みは、「すべて」（`all`）に対するこの口で取る。作品一覧・値一覧の旧 `/api/works`・`/api/axes/:axis` は持たない
- 読めない行があれば、一覧も、その行を引く口も 500 を返し、本文とログに行の ID と直し方を出す（前述の保存先）

### 条件の編集

条件を組む画面は後の段階で作る。今の `SmartFolderEditorModal` は移植しない。それまで条件を変える手段は次の4つで、どれもこの木の上の操作である。「すべて」の条件は変えられないので、上書きと × で外すは「すべて」以外が対象になる。

- 上書き: グループ分けを持たないスマートフォルダーの条件に、今の絞り込み（チップ・検索語）を足した木で置き換える。今の並びを変えていればそれを既定の並びにする。更新するのは条件（と変えた既定の並び）だけで、「元に戻す」も上書きが更新した項目だけを上書き前の値にする（上の部分更新）
- × で外す: 編集のダイアログで、条件からルート直下の子（述語か、まとまり）を1つずつ外す
- 別名で保存: 今の状態から新しいスマートフォルダーを作る
- 削除

保存の中身は、保存直後に同じ作品が見えるように組む。

- 別名で保存（「検索を保存」も同じ）: 元の条件・選択中のグループの値・チップ・検索語を条件にまとめる。グループの値を選んでいればグループ分けは外し、選んでいなければ（値一覧で絞り込んだとき）グループ分けと値の並びを保つ。既定の並びは、今の並びを変えていなければ元のスマートフォルダーの既定の並び（「『すべて』と同じ」なら「『すべて』と同じ」のまま。元が「すべて」のときも「『すべて』と同じ」）、変えていればその並び
- 上書き: グループ分けを持たないものだけが対象。グループ分けを持つもので絞り込んだ状態は、別名で保存（「検索を保存」）になる。チップか並びを変えたときの保存には検索語も含める
- 絞り込みのない状態からの複製: 元の定義の既定の並びをそのまま写し、グループ分けも保つ（値を選んでいないグループ分けのスマートフォルダーからの複製も同じ。継承なら継承、ランダムならランダム）

画面から組めない条件（`or`・`not` を含むもの）は、API へ条件の JSON を送れば作れる。

```sh
# folder.json
{
  "name": "寝落ち用",
  "condition": {
    "type": "and",
    "children": [
      { "type": "or", "children": [{ "type": "tag", "tag": "添い寝" }, { "type": "tag", "tag": "睡眠導入" }] },
      { "type": "not", "child": { "type": "tag", "tag": "耳かき" } },
      { "type": "duration", "op": "lte", "sec": 3600 }
    ]
  },
  "sort": null,
  "groupBy": null,
  "groupSort": null
}

# 作る（Linux・Windows 共通。ポートは既定の 8080）
curl -X POST http://127.0.0.1:8080/api/smart-folders -H "content-type: application/json" -d @folder.json
# 既存の条件だけを置き換える（condition.json は { "condition": … }）
curl -X PATCH http://127.0.0.1:8080/api/smart-folders/<id> -H "content-type: application/json" -d @condition.json
```

### 移行

互換処理は書かない。user migration で `smart_folders` を DROP して上の形で CREATE し、`tag_prefixes.show_as_axis` も DROP する。既存のスマートフォルダーは失われるので、更新前に控えて手で作り直す。更新後の最初の起動で、既定の11本（「すべて」を含む）が入る。

```sh
# 更新前に控える（Linux）
sqlite3 "${XDG_DATA_HOME:-$HOME/.local/share}/mimimilli/db/user.sqlite" "SELECT name, sort, rules_json FROM smart_folders"
# 更新前に控える（Windows、cmd）
sqlite3 "%LOCALAPPDATA%\mimimilli\db\user.sqlite" "SELECT name, sort, rules_json FROM smart_folders"
```

`group_sort` は migration 0007 を作り直して足した。0007 を `group_sort` なしで適用済みの開発用 DB は、アプリを止めて次を実行する。

```sh
# Linux
sqlite3 "${XDG_DATA_HOME:-$HOME/.local/share}/mimimilli/db/user.sqlite" "ALTER TABLE smart_folders ADD COLUMN group_sort TEXT; UPDATE smart_folders SET group_sort = CASE WHEN json_extract(group_by_json, '$.kind') = 'addedYear' THEN 'name-desc' ELSE 'count-desc' END WHERE group_by_json IS NOT NULL;"
# Windows、cmd
sqlite3 "%LOCALAPPDATA%\mimimilli\db\user.sqlite" "ALTER TABLE smart_folders ADD COLUMN group_sort TEXT; UPDATE smart_folders SET group_sort = CASE WHEN json_extract(group_by_json, '$.kind') = 'addedYear' THEN 'name-desc' ELSE 'count-desc' END WHERE group_by_json IS NOT NULL;"
```

`MIMIMILLI_DATA_DIR` を設定しているときはその下の `db/user.sqlite` を読む。更新後は、控えを見ながら画面か上の API で作り直す。旧ルールの `AND`・`AND NOT`・`OR` の並びは、多くは「ルートの `and` の下に `or` と `not`」の形に直せる。直せないもの（`AND NOT` のあとに `OR` が続くものなど）は、分けて作るか形を変える。

## 帰結

- 一覧・値一覧・件数の評価経路が、条件の木1本になる。fixture と real の違いは `createMatcher` と `compileCondition` の違いだけになり、契約テストも1形式で済む
- 「お気に入り」「最近再生」「CV別」も、ユーザーが消したり、条件やグループ分けを変えたり、同じ形のものを足したりできる。既定の値をすべて消した状態も正常な状態として扱う
- core と SQL の二重実装は残る。一致を保つ責任は意味表と契約テストにあり、述語を足すたびに表と生成器を更新する
- 読めない行があるとライブラリの一覧が開けなくなる。直すのは示されたコマンドで行を消すことで、述語や並びを変える開発では migration での JSON の書き換えが必須になる
- [ADR-0026](0026-value-list-as-global-entry.md) の「任意の検索式を扱う汎用の AST は導入しない」「保存ルールの OR・除外の表現力は維持する」「性能の推測だけを理由に全 SQL 化しない」の3文を撤回する。条件の木はまさに汎用の AST で、評価はすべて SQL に寄せる
- 条件を組む画面ができるまで、`or` や除外（`not`）を画面から新しく組めない。足す方向は上書き、減らす方向は × で外す、それ以外は API に JSON を送るしかない
- チップを OR でつなぐ絞り込みはできなくなる。「A か B」は `or` を含む条件として保存して使う
- ランダムの seed をサーバーが発行しなくなる。seed を送らないクライアントは `sort=random` を使えない
- 値一覧の件数の意味が変わる。[ADR-0026](0026-value-list-as-global-entry.md) の「件数はライブラリ全体の件数」は、「グループ分けを持つスマートフォルダーの条件をかけた後の件数」になる。既定の CV別などは条件が空なので、絞り込みが無ければ見た目の数字は今と同じ。値一覧でもチップと検索語が効く（[ADR-0041](0041-library-sidebar-shell-navigation.md)）
- [ADR-0005](0005-tags-as-sole-attribute.md) §3 の「軸レール = 非タグ由来のビュー＋軸表示 ON の prefix＋スマートフォルダー」は、スマートフォルダーだけになる。prefix 定義は軸表示を持たなくなり、表示ラベル・色・保護・表示優先度だけを持つ
- [ADR-0012](0012-library-axis-as-value-browse.md) の決定1（軸は値ブラウズのビュー）は、グループ分けを持つスマートフォルダーの値一覧に置き換わる。決定2（値の選択はタグフィルタ）のうち、グループの値はチップではなくグループの値として持つ。チップと擬似タグ `@year/…` は残る
- [ADR-0016](0016-view-axis-consolidation.md) のビュー軸5つは既定のスマートフォルダーに置き換わる。エラーの「0件なら出さない」は引き継がず、常に出す
- 既存のスマートフォルダーは移行されない。手で作り直す
- 「最近再生」の並びが最終再生順になる。今のビューは URL の sort で並ぶので、開いたときの見え方が変わる
- 次の段階の課題として、条件を組む画面、条件の種類を増やすこと（レーティングなど）、下書きの条件の件数（preview API）が残る。実装の順序はタスクで扱う
