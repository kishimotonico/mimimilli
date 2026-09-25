# ADR-0031: ナビゲーション状態を型付きAppRouteに一本化する

- ステータス: 承認
- 日付: 2026-09-25
- 関連: [ADR-0012](0012-library-axis-as-value-browse.md)（軸の値選択）、[ADR-0013](0013-tag-click-replaces-all.md)（タグ操作）、[ADR-0026](0026-value-list-as-global-entry.md)（値一覧はq・tagsを持たない）、[ADR-0029](0029-root-reconfiguration-workflow.md)（root再設定の突入時リセット）、backlog TASK-466

## 文脈

画面mode、Libraryの軸・選択タグ・選択作品・sort・検索語、Filesの場所・選択、作品詳細IDが、`shared` と `entities`（library・work・file-system）の別々のatomに置かれていた。push/replaceの要求もcommit要求atomとして別に置かれ、各操作が状態を書くたびに要求を積み、同じバッチではpushが勝つ規則でまとめていた。

URLとの同期は `useNavigationHistory` が一手に担い、10個のatomを購読し、URLから各atomへ項目ごとに書き戻し、別のeffectでatom群からURL用の状態を項目ごとに組み立てていた。route項目を1つ足すと、parse/serializeに加えて購読・setter・適用の分岐・再構成の分岐・effectの依存配列まで手を入れる必要があった。

同期フックは通常画面の中にマウントされていたため、root再設定の画面（`startupState=reconfiguring`）が出ている間は動かない。TASK-469.2では、突入時にatomを既定へ戻してもURLが古いまま残り、通常画面へ戻った瞬間にURLから古い状態が復元される問題が出た。これに対して、URLを直接 `replaceState` で書き換える関数と、atomを既定へ戻すatom 2つの計3点を突入時に呼ぶ形で対処していた。

URLは現在の画面だけを表すが、状態は画面をまたいで残っている。Files表示中もLibraryの軸・タグ・検索語は保持され、LeftNavでLibraryへ戻ると元の絞り込みが復元される。作品詳細画面では検索欄とタグクリックがLibraryの状態を書き換え、そのあとLibraryへ移る。URLと1対1の型だけを正本にすると、この保持が失われる。

## 決定

### AppRouteの型

ナビゲーション状態の正本を型付きの `AppRoute` 1つにする。

```ts
type AppRoute = {
  library: LibraryUrlState; // 軸・選択タグ・選択作品・sort・検索語
  files: FilesUrlState; // 場所・選択
} & (
  | { mode: "library" }
  | { mode: "files" }
  | { mode: "nowPlaying" }
  | { mode: "workDetail"; workId: string }
);
```

- `library` と `files` は、表示中のmodeに関係なく常に持つ。他の画面にいる間もLibraryとFilesの状態を保持するため。
- 作品詳細IDは `workDetail` の変種だけが持つ。作品詳細は開くたびに対象を指定するので、保持しない。
- URL側の型 `NavigationUrlState`（modeごとの判別共用体）と `parseNavigationUrl` / `serializeNavigationUrl` はそのまま残し、URL形式は変えない。`AppRoute` とURLの対応は2つの関数で表す。
  - `AppRoute` → URL: 表示中のmodeの部分だけを `NavigationUrlState` として取り出してserializeする。
  - URL → `AppRoute`: parseした `NavigationUrlState` を現在の `AppRoute` に重ねる。URLに載っていない部分（Files表示中のLibraryの状態など）は現在の値を残す。
- この対応関数とparse/serializeの組を `RouteCodec` とし、同期はcodecだけを通してURLを扱う。

### 正本と派生atom

- `AppRoute` を持つatomを1つ置き、初期値はストア生成時のURLから決める（`atomWithLazy`）。初回描画から派生atomがURLどおりの値を返す。
- 画面mode（`appModeAtom`）、Libraryの5項目（`activeAxisAtom`・`selectedTagsAtom`・`selectedWorkIdAtom`・`sortAtom`・`librarySearchQueryAtom`）、Filesの2項目（`filesRelPathAtom`・`filesSelectedPathAtom`）、作品詳細ID（`workDetailIdAtom`）は、route atomからの読み取り専用の派生atomにする。置き場所は今のまま各entityのmodelに置き、読む側のimportは変えない。
- route atom自体と汎用の書き込み口は、項目を知らない汎用コードとして `shared/model` に置く。`AppRoute` の型・codec・インスタンスは、parseが `entities/library` の軸定義を使うため `entities/navigation` に置く。

### navigateの契約

route atomの書き込み口は `navigate` と、ブラウザー履歴からの適用の2つだけにする。

```ts
navigate(
  next: AppRoute | ((current: AppRoute) => AppRoute),
  options?: { replace?: boolean; direction?: "forward" | "back" },
): void
```

- 既定はpush。`replace: true` で現在の履歴エントリを置き換える。
- `next` が現在のrouteと同一なら何もしない。
- 同期がURLへ書くまでに複数回呼ばれたら、1つの履歴エントリにまとめ、1回でもpushがあればpushにする。
- `direction` は遷移の向きで、既定は `"forward"`。Filesのカラム遷移アニメーションが使う（後述）。
- 各操作（軸の切り替え、タグの追加・置換・解除、作品選択、sort、検索語、Filesの移動と選択、作品詳細を開く、Filesで開く、画面modeの切り替え）は、「現在のrouteから次のrouteとpush/replaceを計算する純粋関数」と、その結果で `navigate` を呼ぶwrite atomの組にする。push/replaceの規則は純粋関数の側に置く。
  - Library: 軸の切り替え・タグの追加/置換/解除・作品の新規選択はpush。選択中の作品の切り替えと解除、sort、検索語はreplace（ADR-0012・ADR-0013の操作規則をそのまま保つ）。
  - Files: フォルダーを開く・パンくずで戻る・1つ上へはpush、エントリの選択と解除はreplace。
  - 画面modeの切り替え・作品詳細を開く・Filesで開くはpush。無効になった画面からの退避はreplace。
- 複数の状態を書く操作（再生中の作品をLibraryで表示する等）は、次のrouteを1回で計算して1回だけ `navigate` を呼ぶ。
- commit要求atom（push/replaceの要求を別atomに積む仕組み）は廃止する。

### URL同期

- 同期は1か所に置き、`startupState` による画面の出し分けより外（`Providers`）で常時マウントする。root再設定の画面が出ている間もrouteとURLは一致し続ける。
- 同期はroute型に対して汎用で、項目名を参照しない。
  - routeが変わったら `serialize(route)` と現在のURLを比べ、違えば `navigate` が指定したpush/replaceで履歴へ書く。同じなら書かない。
  - popstateと初回ロードでは、URLをparseしてrouteへ適用するだけにする。URLが正規形でなければ正規形へreplaceする。適用後のrouteをserializeするとURLと一致するので、履歴へは書かない。
  - 戻る/進むの可否（履歴エントリのindexとsessionStorageの最大index）も同期が持つ。
- route項目を足すときは、`AppRoute`（`LibraryUrlState` などの部分型）とparse/serializeを変えれば済む。同期と派生atomの仕組みは変えない。

### root再設定の突入時リセット

TASK-469.2の3点（URLを直接書き換える `resetLibraryNavigationUrl`、`resetNavigationToDefaultAtom`、`resetLibraryNavigationAtom`）を廃止し、`navigate(既定のAppRoute, { replace: true })` の1操作にする。突入時の後処理とdrift検知（`RootReconfigurationDriftEffect`）はこの操作を呼ぶ。同期が常時マウントなので、再設定画面の表示中でもURLはその場で既定へ置き換わり、通常画面へ戻ったときに古いURLから状態が復元されることはない。

既定のAppRouteはLibraryの全作品一覧で、sortも既定値へ戻す。

### URLと無関係な状態

AppRouteには入れず、今のまま別のatomに置く。

- 表示密度（表示モード・タイルサイズ・グリッドレイアウト）、値一覧のsort、モーダル、`<dialog>` スタック、トースト。
- ランダムsortのseed（`randomSeedAtom`）。URLに載らないので、navigationのatomファイルから `features/library/model` へ移す。
- Filesのカラム遷移の向き。navigationのatomファイルからは外し、汎用の遷移方向atomとして同期が持つ。`navigate` の `direction` と、popstateでの履歴indexの前後から決める。Filesのカラムは表示中のフォルダーが変わったときだけこの向きでアニメーションする。

### 他のADRとの関係

- [ADR-0012](0012-library-axis-as-value-browse.md)・[ADR-0013](0013-tag-click-replaces-all.md): 軸の値選択とタグ操作の規則（置換で作品一覧へ進む、AND追加は現在地に留まる、yearは単一選択、作品選択のpush/replace）は変えない。置き場所がLibraryの遷移を計算する純粋関数になる。
- [ADR-0026](0026-value-list-as-global-entry.md): 値一覧へ移るときにq・tagsを消す規則は軸切り替えの純粋関数が持ち、URLから値一覧のq・tagsを復元しない規則はparseが持つ。どちらも変えない。
- [ADR-0029](0029-root-reconfiguration-workflow.md): 突入時の後処理のうち、ナビゲーションの既定化を本ADRの1操作に置き換える。後処理の他の手順と呼び出し元（自前の開始・起動時の検知・drift検知）は変えない。

## 帰結

- ナビゲーション状態の正本が1つになり、画面の各部分はそこから派生した値を読む。状態の書き込み経路は `navigate` と履歴からの適用に限られる。
- route項目の追加が、型とparse/serializeの変更で閉じる。同期コードは項目の増減で変わらない。
- push/replaceの規則は各操作の純粋関数にまとまり、同期の実行タイミングとは独立にテストできる。
- 同期が常時マウントになり、root再設定のリセットはURLを直接触らずに1操作で済む。
- 画面をまたいだLibrary・Filesの状態の保持は続く。その分 `AppRoute` はURLより情報が多く、URLからの適用は「現在のrouteに重ねる」操作になる。
- 「Filesで開く」は、Files表示中に呼んでもpushになる。以前は画面modeが変わるときだけpushだった。
- root再設定の突入時にsortも既定へ戻る。以前はsortだけ残っていた。
- 遷移方向は、方向を指定しない遷移のたびに `"forward"` へ戻る。Filesのカラムは表示中のフォルダーが変わるときにしか向きを使わないので、見た目の差は「Filesで開く」の遷移が常に前進向きになる点だけ。
