# ADR-0040: ライブラリのビューをスマートフォルダーに一本化し、条件の木で評価する

- ステータス: 承認
- 日付: 2026-11-22
- 関連: [ADR-0005](0005-tags-as-sole-attribute.md)（§3 を本ADRで改訂）、[ADR-0008](0008-persistence-topology-query-ownership-playback-ids.md)（core↔SQL の例外表を本ADRで改訂）、[ADR-0012](0012-library-axis-as-value-browse.md)（決定1・2を本ADRで改訂）、[ADR-0016](0016-view-axis-consolidation.md)（ビュー軸を本ADRで置き換え）、[ADR-0026](0026-value-list-as-global-entry.md)（3文を撤回し、値一覧の件数の意味を改訂）、[ADR-0039](0039-scan-modal-current-problems-and-explicit-states.md)（データ不整合の件数）、[ADR-0041](0041-library-sidebar-shell-navigation.md)（画面・URL・履歴）、[design-system.md](../design-system.md)（見送り案「軸レールの各軸に件数を出す」を本ADRで撤回）、backlog DRAFT-50

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
- 深さやノード数の上限は設けない。保存できる形が1段なので要らない

保存時（POST・PUT）に正規化する。

- 子が1つの `or` は畳む（`or([x])` → `x`、`not(or([x]))` → `not(x)`）。畳むのはルートの内側だけ
- 同じ親の中の重複した子は落とす。重複かどうかは、オブジェクトのキー順を無視した構造の一致で決める。タグの正規化（prefix の小文字化・trim）は既存の `tagSchema` に任せる
- まとまり（`or`・`not(or)`）はまとまりごと外す。まとまりの中の子だけを外す操作は持たず、空の `or` は残らない

「お気に入りの案内を出す」「エラーの一括解除バナーを出す」のように画面が条件の意味を知りたいときは、ID ではなく条件の形で判定する（ルートの子が `bookmarked` だけ、`hasError` だけ、など）。判定は shared の関数1つにまとめ、空状態・バナー・0件時の非表示が同じものを呼ぶ。この判定は上の正規化を前提にする。スキャンの要対応からエラーの一覧へ移る導線（backlog DRAFT-70）も、`error` の ID ではなく条件が `hasError` だけのスマートフォルダーを探す。見つからないときの扱いは DRAFT-70 で決める。

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
- 期間の基準時刻 `now` は評価コンテキストとして受け取る。`matchCondition(condition, work, { now })` と `compileCondition(condition, { now })` が同じ値を受け、どちらも自分で `Date.now()` を呼ばない。`now` は route が1リクエストにつき1回作ってアダプタへ渡す。テストは固定時刻で回す
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

fixture は core の `matchCondition` だけを、real は `compileCondition` を `queryWorks` の WHERE に入れる形だけを使う。fixture がインメモリで core を呼ぶ以上、core と SQL の二重実装は残る。一致は契約テストで縛り、テストは「同じ木を両方に渡し、順序付きの作品 ID 列・`total`・グループの値と件数・件数を比べる」1つの形式にする。木の生成器は上の意味表の境界（長さ不明、未再生、基準時刻ちょうど、`not` の下の不明な値）を必ず含める。

### ADR-0008 の例外表の改訂

ADR-0008 の「core↔SQL二重実装の統制」を次のように改める。

- 「作品検索」の例外は、条件の木の評価を含む。`queryWorks`・`groupWorks`・`countByConditions` はすべて `compileCondition` を通し、core 側の対応は `matchCondition` と `queryWorksByCondition`
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

shared にテンプレートを持ち、初回起動時に1回だけ投入する。テンプレートは13本、最初に入れるのは11本。

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

- 「すべて」は条件なし・グループ分けなし・削除不可を、画面だけでなくサーバーでも保証する。行は seed ではなく user migration で INSERT する。「すべて」が無い状態を扱うコードは書かない。fixture は migration を通らないので、fixture でも「すべて」が必ずある作りにする
- 「すべて」の定義は migration とテンプレートの2か所に現れるので、両者の一致を見るテストを持つ
- 残りの既定は `app_settings` の `smart_folders_seeded`（user に分類する）を立てて1回だけ入れる。全部消しても戻さない。`tag_prefixes_seeded` と同じやり方
- 「非表示」は持たない。要らないものは削除する。消した既定は「既定から追加」で戻す。候補はテンプレートの固定 ID のうち今ない ID で、`templateKey` のような列は作らない
- ユーザーが作るものの ID は今と同じ `sf-<uuid>`
- 0件のときに行を隠すかどうかは列にしない。条件が `hasError` だけのものを隠す候補とし、条件の形で決める（隠す条件は「件数」の節）

既定のスマートフォルダー（テンプレートの固定 ID を持つもの）で変えられるのは、名前・既定の並び・値の並び・位置と、削除だけにする。条件とグループ分けは変えられない。編集のダイアログでは条件を読み取り専用で見せ、× で外すこともできない。変えたいときは複製してから変える。サーバーも、既定のものへの条件・グループ分けの変更を弾く。「すべて」はさらに削除と名前の変更もできず、変えられるのは既定の並びと位置だけになる（「すべて」は値の並びを持たない）（位置は並べ替え API で動かす）。

ID で分けるのは、この編集の権限（と、上書きを出すかどうか）と、条件だけで決まる既定のスマートフォルダー（すべて・ランダム・最近再生・最近追加・お気に入り・エラー）のアイコンだけである。グループ分けを持つスマートフォルダーのアイコンは、ID ではなくグループ分けから引く。お気に入りの案内やエラーのバナーのように条件の意味で決まるものは、上に書いたとおり条件の形で判定する。

### 保存先

`smart_folders` を作り直す。

```
smart_folders(id TEXT PK, name TEXT, condition_json TEXT, sort TEXT NULL,
              group_by_json TEXT NULL, group_sort TEXT NULL, position INTEGER, created_at TEXT)
```

- `group_by_json` と `group_sort` は、どちらも null か、どちらも値を持つかのどちらか。組が合わない行や `group_sort` が読めない行は壊れた行として返す（`groupSort` も null）

- 並び順は `position` の整数で持ち、並べ替えは全件の順序を送る PUT にする。スマートフォルダーは多くても数十本
- 保存できる形かどうかの検証は保存時（POST・PUT）だけで行う。DB から読むときは木として読めるかだけを検証する。読み出しの検証を絞ると、あとで形を変えたときに既存の行が読めなくなる
- 読めない行が1つあっても一覧 API を落とさない。その行は「条件が壊れている」と分かる形で返し（後述の HTTP の契約）、削除と作り直しができるようにする。黙って飛ばすことも、サイドバー全体を 500 にすることもしない
- サイドバー用の別テーブル（`sidebar_items` のようなもの）は作らない

### 件数

件数は、画面に出すスマートフォルダーと、0件で隠すかを判定するスマートフォルダーだけを `countByConditions` で1往復で数える。空のライブラリでは0を返す。

- 件数は SQL の値で、読めない作品は数に含まれる。差はデータ不整合の件数が示す
- 条件が空のもの（すべて・ランダム）とグループ分けを持つものには件数を出さない。「最近再生」には出す
- 件数を出さないものでも、0件で隠すかの判定に要るなら数える（グループ分けを付けたエラーなど）
- 条件が `hasError` だけのものの件数は、その条件に合う作品数とする。行を隠すのは、この作品数と、診断上のデータ不整合の件数（[ADR-0039](0039-scan-modal-current-problems-and-explicit-states.md)。保存された値を読めず一覧から外れる作品）の両方が0と分かったときだけにする。データ不整合だけが残っているときに、エラーへの入口を消さないため
- 再生を始めたときは件数だけを取り直し、開いている一覧の並びは動かさない。「最近再生」を開いて再生した作品が、その場で先頭へ動くことはない
- 再生を始めたときはグループの値一覧を取り直さない。開いている値一覧を動かさないことを優先する。お気に入りの切り替えは、`bookmarked` を条件にしたグループ分けの値の集合を変えるので、値一覧も取り直す
- 1クエリで合計するか、スマートフォルダーごとに数えるか、`hasPrefix` のために tags へ prefix の派生列を足すか、件数の細かい無効化をするかは、30k ベンチで必要が見えてから決める

[design-system.md](../design-system.md) の見送り案「軸レールの各軸に件数を出す」は撤回する。見送りの理由のうち「値の個数か作品数か区別できない」はグループ分けのスマートフォルダーに件数を出さないことで、「全件集計が走る」は1往復の集計とベンチで答える。

### HTTP の契約

アダプタの口の外側（`/api/smart-folders` 以下）で、次を決めておく。パスの細部はタスクで決める。

- 件数: どのスマートフォルダーを数えるかはサーバーが選ぶ。shared の判定関数で「件数を出すもの」「0件で隠すかの判定が要るもの」を決めて数え、スマートフォルダー一覧の応答に載せる
- 値一覧と「＋絞り込み」の候補: 同じ口で扱う。スマートフォルダー＋グループの値＋チップ＋検索語から組んだ条件と、任意の `groupBy` を受ける。そのスマートフォルダー自身の値一覧と、任意の `groupBy` での候補の2つの用途がある
- スキャン記録の絞り込み: 作品一覧の口が `scanRecord`（`new`・`updated`）と `scanChange` を受け、サーバーが記録から作品の ID 集合を引いてアダプタの `ids` に渡す。ライブラリ全体の件数・統計、スキャン画面の新規作品・更新済みは、「すべて」（`all`）に対するこの口で取る。作品一覧・値一覧の旧 `/api/works`・`/api/axes/:axis` は持たない
- 既定から追加: テンプレートの ID を指定し、固定 ID で作る口を持つ。通常の作成（`sf-<uuid>` を採番する POST）とは別にする
- 既定の並びだけの更新: `PUT /smart-folders/:id/sort`（`{ sort }`）。ほかの列は触らないので、別タブでの編集を巻き戻さない。「すべて」の並びは null にできない
- 値の並びだけの更新: `PUT /smart-folders/:id/group-sort`（`{ groupSort }`）。同じくほかの列は触らない。グループ分けのない行・壊れた行は弾く（400・403）。行はあるがグループ分けが外されて更新できなかったときは 409
- 条件だけの更新: `PUT /smart-folders/:id/condition`（`{ condition, sort? }`）。検索の上書きとその「元に戻す」が使い、条件と、`sort` を渡したときだけ既定の並びを更新する。名前・グループ分け・値の並びは送らず触らないので、上書き後に別タブで保存した編集を巻き戻さない。同じ項目の同時編集は後勝ちにする。既定のスマートフォルダー・壊れた行は弾く（403）
- 作成・更新・復元の本文は `groupSort` を持ち、`groupBy` の有無と整合しないものは 400。テンプレートからの追加は `groupSort` をテンプレートの値で入れる
- 値一覧（`POST /smart-folders/:id/groups`）は `groupSort` を必須で受ける（サーバーは既定を補わない。クライアントが保存済みか今の並びを渡す）。応答の各値は `value`・`sortKey`・`lastAddedAt`・`lastPlayedAt`・`count`・`durationSec`・`covers`
- 削除の取り消し: サーバーは削除をすぐ行う。取り消しは、同じ ID・位置・作成日時の行をそのまま戻す復元の口で行う。履歴に残った `/library/<id>` が、戻したあとも同じ行を指すようにするため
- 読めない行: `condition` を null にし、壊れていることを示す形で返す。クライアントの `resolveLibraryView`（[ADR-0041](0041-library-sidebar-shell-navigation.md)）はこの行を開けない状態（削除だけできる）として扱い、件数の対象からも外す
  - 壊れた「すべて」は UI から直す手段を設けず、データを手で直すものとする。それまで「すべて」の並びを継承する作品一覧は開けず、継承する行にも固有の並びを付けて救える

### 条件の編集

条件を組む画面は後の段階で作る。今の `SmartFolderEditorModal` は移植しない。それまで条件を変える手段は次の4つで、どれもこの木の上の操作である。既定のスマートフォルダーの条件は変えられないので（前述）、上書きと × で外すは自作のものだけが対象になる。

- 上書き: 自作でグループ分けを持たないスマートフォルダーの条件に、今の絞り込み（チップ・検索語）を足した木で置き換える。今の並びを変えていればそれを既定の並びにする。更新するのは条件（と変えた既定の並び）だけで、「元に戻す」も上書きが更新した項目だけを上書き前の値にする（上の条件だけの更新）
- × で外す: 編集のダイアログで、自作のスマートフォルダーの条件からルート直下の子（述語か、まとまり）を1つずつ外す
- 別名で保存: 今の状態から新しいスマートフォルダーを作る
- 削除

保存の中身は、保存直後に同じ作品が見えるように組む。

- 別名で保存（「検索を保存」も同じ）: 元の条件・選択中のグループの値・チップ・検索語を条件にまとめる。グループ分けは外す（作品一覧ではグループの値は必ず選ばれている）。既定の並びは、今の並びを変えていなければ元のスマートフォルダーの既定の並び（「『すべて』と同じ」なら「『すべて』と同じ」のまま。元が「すべて」のときも「『すべて』と同じ」）、変えていればその並び
- 上書き: 自作でグループ分けを持たないものだけが対象。グループ分けを持つ自作のもので値を選んだ状態は、別名で保存（「検索を保存」）になる。チップか並びを変えたときの保存には検索語も含める
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
  "groupBy": null
}

# 作る（Linux・Windows 共通。ポートは既定の 8080）
curl -X POST http://127.0.0.1:8080/api/smart-folders -H "content-type: application/json" -d @folder.json
# 既存の条件を置き換える
curl -X PUT http://127.0.0.1:8080/api/smart-folders/<id> -H "content-type: application/json" -d @folder.json
```

### 移行

互換処理は書かない。user migration で `smart_folders` を DROP して上の形で CREATE し、「すべて」の行を INSERT する。`tag_prefixes.show_as_axis` も DROP する。既存のスマートフォルダーは失われるので、更新前に控えて手で作り直す。更新後の最初の起動で、既定の11本（「すべて」を含む）が入る。

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

- 一覧・値一覧・件数の評価経路が、条件の木1本になる。fixture と real の違いは `matchCondition` と `compileCondition` の違いだけになり、契約テストも1形式で済む
- 「お気に入り」「最近再生」「CV別」も、ユーザーが消したり、同じ形のものを足したりできる。既定の値をすべて消した状態も正常な状態として扱う
- core と SQL の二重実装は残る。一致を保つ責任は意味表と契約テストにあり、述語を足すたびに表と生成器を更新する
- [ADR-0026](0026-value-list-as-global-entry.md) の「任意の検索式を扱う汎用の AST は導入しない」「保存ルールの OR・除外の表現力は維持する」「性能の推測だけを理由に全 SQL 化しない」の3文を撤回する。条件の木はまさに汎用の AST で、評価はすべて SQL に寄せる
- 条件を組む画面ができるまで、`or` や除外（`not`）を画面から新しく組めない。足す方向は上書き、減らす方向は × で外す、それ以外は API に JSON を送るしかない。どれも自作のスマートフォルダーに対する操作で、既定のものの条件を変えるには複製が要る
- チップを OR でつなぐ絞り込みはできなくなる。「A か B」は `or` を含む条件として保存して使う
- ランダムの seed をサーバーが発行しなくなる。seed を送らないクライアントは `sort=random` を使えない
- 値一覧の件数の意味が変わる。[ADR-0026](0026-value-list-as-global-entry.md) の「件数はライブラリ全体の件数」は、「グループ分けを持つスマートフォルダーの条件をかけた後の件数」になる。既定の CV別などは条件が空なので、見た目の数字は今と同じ。値一覧で q・tags を効かせない規則は変えない
- [ADR-0005](0005-tags-as-sole-attribute.md) §3 の「軸レール = 非タグ由来のビュー＋軸表示 ON の prefix＋スマートフォルダー」は、スマートフォルダーだけになる。prefix 定義は軸表示を持たなくなり、表示ラベル・色・保護・表示優先度だけを持つ
- [ADR-0012](0012-library-axis-as-value-browse.md) の決定1（軸は値ブラウズのビュー）は、グループ分けを持つスマートフォルダーの値一覧に置き換わる。決定2（値の選択はタグフィルタ）のうち、グループの値はチップではなくグループの値として持つ。チップと擬似タグ `@year/…` は残る
- [ADR-0016](0016-view-axis-consolidation.md) のビュー軸5つは既定のスマートフォルダーに置き換わる。エラーの「0件なら出さない」は条件の形で引き継ぐ
- 既存のスマートフォルダーは移行されない。手で作り直す
- 「最近再生」の並びが最終再生順になる。今のビューは URL の sort で並ぶので、開いたときの見え方が変わる
- 次の段階の課題として、条件を組む画面、条件の種類を増やすこと（レーティングなど）、0件で隠す設定の画面、下書きの条件の件数（preview API）が残る。実装の順序はタスクで扱う
