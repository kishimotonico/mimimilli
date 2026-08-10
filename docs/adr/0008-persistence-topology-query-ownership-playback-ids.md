# ADR-0008: 永続化トポロジー・検索所有権・再生IDを分離する

- ステータス: 承認
- 日付: 2026-07-19
- 関連: [ADR-0003](0003-no-db-migrations.md)、[ADR-0004](0004-core-functions-over-sql.md)、[ADR-0007](0007-bun-distribution-runtime.md)、backlog TASK-71、DRAFT-25、DRAFT-26、DRAFT-27、[Bun配布スパイク](../../scripts/spike/bun-distribution/README.md)

## 文脈

現行SQLiteは、`.meta.json`（メタファイル名は [ADR-0010](0010-meta-file-rename-mimimilli-json.md) により `mimimilli.json` へ変更）とファイル走査から戻せる作品カタログ、プローブ結果のキャッシュ、設定・ブックマーク・再生状態を1ファイルに置いている。現在の開発フェーズでは、ユーザーの保存データを含む破壊的変更を許容しており、スキーマ世代が合わないDBは再作成できる。一方、配布を始めて作者以外のユーザーのデータを預かる段階では、userデータを保ったまま更新する仕組みが必要になる。

DBを分ける主目的は、catalog再構築がuserデータに触れる経路を物理的に無くし、再構築処理を単純にすることである。開発中にuser DBを再作成できることとは分けて考える。

作品一覧はrealアダプタでも全件をメモリへ読み、`core/worksQuery`で検索・ソート・ページングする。30,000作品を対象にすると、この方法ではページングしても全件取得の費用が残る。一方、`bookmarked`、`lastPlayedAt`、`addedAt`は再構築可能な作品情報と異なる寿命を持つため、DBを分けるだけでは、それらを使う絞り込み・ソート・ページングを正確に行えない。

現在のresumeは作品IDに対する`{trackIndex, position}`である。`position`は音声ファイルの絶対秒で、トラックの並べ替えや区間変更に耐えない。PlaylistとTrackには安定IDがなく、既存`.meta.json`へIDを追加するには、ユーザーが管理するファイルを一括変更する移行が必要になる。

[ADR-0007](0007-bun-distribution-runtime.md)のスパイクにより、配布ランタイムはBun、SQLiteは`bun:sqlite`、データルートはWindowsで`%LOCALAPPDATA%\Mimikago`となった。`bun:sqlite`による2DB同時接続と`ATTACH`も実測済みである。本ADRではこの制約を前提に、データの帰属、DB間の読み方、検索仕様の置き場、ID移行、バックアップをまとめて決める。

## 決定

### データの分類

分類は列の値を失ったときの回復元で決める。

- catalog: `.meta.json`（現行は `mimimilli.json`。[ADR-0010](0010-meta-file-rename-mimimilli-json.md)）またはファイル走査から再構築できる
- user: DBが正本であり、再スキャンでは同じ値に戻らない
- 派生キャッシュ: catalogまたはファイルから計算し直せる。失っても意味上のデータは失わない

現行`schema.ts`と`db.ts`の全テーブル・全列を次のように分類する。複数列を記した行も、列名を省略していない。

| 現行テーブル        | 現行列                                                                                  | 分類           | 回復元・扱い                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `works`             | `id`                                                                                    | catalog        | `.meta.json.id`（現行は `mimimilli.json`。[ADR-0010](0010-meta-file-rename-mimimilli-json.md)）。Workの安定ID                                      |
| `works`             | `title`, `cover_image`, `default_playlist`, `created_at`, `urls_json`, `playlists_json` | catalog        | `.meta.json`（現行は `mimimilli.json`）                                                                                                            |
| `works`             | `status`, `physical_path`, `error_message`                                              | catalog        | ファイル走査とメタ検証の結果                                                                                                                       |
| `works`             | `total_duration_sec`                                                                    | 派生キャッシュ | プレイリスト区間と音声プローブから再計算                                                                                                           |
| `works`             | `added_at`                                                                              | user           | 初回登録日時。再構築で現在時刻へ変えてはならない                                                                                                   |
| `works`             | `bookmarked`, `last_played_at`                                                          | user           | ユーザー操作と再生履歴                                                                                                                             |
| `works`             | `resume_position`, `resume_track_index`                                                 | user           | resume v1。移行後はresume v2へ置換                                                                                                                 |
| `tags`              | `id`, `name`                                                                            | catalog        | 正規化した`.meta.json.tags`から再構築。`id`はDB内の代理キー                                                                                        |
| `work_tags`         | `work_id`, `tag_id`                                                                     | catalog        | Workと再構築済みTagの関係                                                                                                                          |
| `work_dlsite`       | `work_id`, `state_json`                                                                 | catalog        | 現行実装は全更新経路で`dlsite`を`.meta.json`（現行は `mimimilli.json`。[ADR-0010](0010-meta-file-rename-mimimilli-json.md)）にも書くため再構築可能 |
| `tag_prefixes`      | `id`, `prefix`, `label`, `color`, `show_as_axis`, `protected`                           | user           | ユーザーが編集する分類軸定義。`id`は表示順も保持する                                                                                               |
| `app_settings`      | `key`, `value`のうち`root_folder`                                                       | user           | ユーザーが選んだライブラリルート                                                                                                                   |
| `app_settings`      | `key`, `value`のうち`tag_prefixes_seeded`                                               | user           | 初期値を再投入してユーザーの削除を取り消さないため保持                                                                                             |
| `app_settings`      | `key`, `value`のうち`last_scan_time`                                                    | 派生キャッシュ | 最後に完了したスキャンから再生成する運用情報                                                                                                       |
| `smart_folders`     | `id`, `name`, `rules_json`, `sort`, `created_at`                                        | user           | ユーザーが作成したフォルダー定義                                                                                                                   |
| `audio_probe_cache` | `path`, `size`, `mtime_ms`, `duration_sec`                                              | 派生キャッシュ | 音声ファイルを再プローブして回復                                                                                                                   |

今後`app_settings`へキーを追加するときは、キーごとにuserか派生キャッシュかを宣言する。寿命の異なる値を未分類のまま汎用KVへ追加しない。

### 2DBの物理構成と接続

データルートの`db/catalog.sqlite`と`db/user.sqlite`へ物理分離する。catalog DBにはcatalogと派生キャッシュを置き、user DBにはuserだけを置く。両方をWALモードで使う。

新しい論理配置は次の通りとする。

| DB               | 主なデータ                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog.sqlite` | Workのメタ・走査状態、Playlist・Track関係、TagとWork-Tag関係、DLsite状態、音声プローブ結果、スキャン状態、検索用の派生キー                                    |
| `user.sqlite`    | Workごとの`addedAt`・`bookmarked`・`lastPlayedAt`、resume v2、設定、タグprefix、検索プリセット、スマートフォルダー、schema version、配布開始後のmigration履歴 |

catalog接続を`main`として開き、user DBを`user`スキーマ名で`ATTACH`する。作品一覧は`main`の作品・タグと`user`の作品状態を同じSQL文でJOINする。`addedAt`を含むuser側の作品状態は、作品をcatalogへ登録する前に冪等なINSERTで作る。起動時の整合性検査で、catalogに存在するのにuser状態がないWorkを検出した場合は、一覧から黙って除外したり現在時刻を補ったりせず、診断可能な整合性エラーとして止める。

PlaylistとTrackは`.meta.json`（現行は `mimimilli.json`。[ADR-0010](0010-meta-file-rename-mimimilli-json.md)）の入れ子構造を正本としつつ、IDと所属関係をcatalog DBの関係表にも展開する。この関係表はcatalogであり、再スキャンで作り直せる。resume v2はuser DBで`work_id`を主キーとし、`playlist_id`、`track_id`、`offset_sec`を保持する。

user DBにはcatalog DBを参照する外部キーを作らない。catalogの削除や再作成からuser状態を切り離し、`ON DELETE CASCADE`も使わない。通常スキャンでは見つからないWorkのcatalog行を`missing`にするため、検索の`missing`表示は維持できる。catalog DBをファイルごと再構築してmissing中のcatalog行がなくなっても、user状態は孤児として残す。同じWork UUIDが再び現れたときにその状態を再接続する。

WALモードでは、ATTACHした複数DBへの書き込みは各DB内では原子的だが、DB集合としては原子的ではない。このため、通常処理でcatalogとuserを同じトランザクションから同時更新しない。スキャンはcatalog、設定・ブックマーク・再生状態はuserという単一所有者へ書く。初回登録のように両方が必要な処理は、先にuserへ冪等に書き、次にcatalogへ書く。途中停止時は再実行で収束させる。

接続候補は次の理由で選ばなかった。

| 候補                              | 判断                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| user状態をcatalogへ投影同期       | 不採用。正本が2か所になり、同期漏れが誤った検索結果やページ境界として現れる                        |
| catalog取得後にuser状態を合成     | 不採用。user条件での絞り込み・ソート後に正しい`LIMIT/OFFSET`を適用できず、結局全件取得が必要になる |
| 単一DBでcatalogテーブルだけ再構築 | 不採用。再構築対象の指定ミスやmigration失敗がuserデータへ到達し、物理分離による保護がない          |
| catalogからuserを`ATTACH`してJOIN | 採用。1つのSQLスナップショット上でuser条件を含む検索・ソート・件数・ページ境界を決められる         |

開発中はcatalog DBとuser DBのどちらも互換migrationを持たず、スキーマ世代が合わなければ再作成してよい。配布開始までに、user DBだけは順序付きのforward migrationへ切り替える。migration前のスナップショットと復元検証も、配布開始の前提条件とする。catalog DBは配布開始後も再構築できる。

スキーマの正本は1系統にし、現行のように実行用DDLと型用スキーマを手動で二重管理しない。配布開始後のuser migrationには、Bun SQLiteで実行できる生成済みmigration SQLをリポジトリへ保存して使う。生成ツールが`bun:sqlite`と整合しない場合だけ、版管理した手書きSQLを代替にできる。その場合は空DBへ適用した実スキーマとの一致テストを必須とする。

### 検索・ソート・ページングの所有権

検索仕様はcoreが所有し、realでの実行はSQLが所有する。

- `WorksQuery`の正規化、各フィルターとソートの意味、nullの順序、同順位の扱いはcoreの契約とする
- `applyWorksQuery`、ファセット集計、スマートフォルダー評価の純粋関数はfixture実装と参照実装として残す
- realアダプタは全件を`applyWorksQuery`へ渡さず、ATTACH JOINを使ったSQLで検索、ソート、総件数、ページングを行う
- routeはクエリを検証してアダプタへ渡すだけとし、SQL断片や検索規則を持たない

作品一覧SQLは、catalog作品とuser作品状態をJOINした共通の絞り込み集合を作る。同じ集合から`COUNT(*)`と、`ORDER BY ... LIMIT ... OFFSET ...`を求める。`bookmarked`、`lastPlayedAt`、`addedAt`、resume有無・位置を使う条件も、ページング前に評価する。resume条件ではuserのresume行をcatalogのPlaylist・Track関係へJOINし、IDを解決できる行だけを有効として扱う。タグのAND/ORと軸絞り込みは`tags`、`work_tags`を使う。

SQLへ直接移せない規則は、catalog DBにcoreと同じ関数で作った検索キー・ソートキーを派生キャッシュとして保持する。それでもSQL化できないスマートフォルダー条件は、SQLで候補を減らしたあと純粋関数で最終評価できる。ルール無し（絞り込みなし・並べ替えのみ）のスマートフォルダーは、条件の最終評価が不要なため `queryWorks` と同じ SQL ソート/ページング経路を使う。ただし、最終評価・ソートを終える前にSQLの`LIMIT/OFFSET`を適用してはならない。正確性を保てない条件を、近似SQLや取得後のページ内フィルターで隠さない。

全ソートは`work_id ASC`を最終タイブレーカーに加え、全順序を定義する。タイトルの検索キーとソートキーには、日本語向けの事前計算キーを使う。coreが所有する1つのキー生成関数で、Unicode NFKC正規化、カタカナからひらがなへの折りたたみ、Unicode既定の`toLowerCase()`を順に適用する。catalogにはその結果を派生キャッシュ列として保存し、SQLはキーのバイト順で並べる。

本アプリは日本語に特化しているため、配布物に外部ICU拡張を加えず、日本語タイトルで実用的な並びを得るこの方式を採る。現行の`localeCompare("ja")`はこの規則へ置き換える。部分一致検索も同じ検索キーを使い、SQLite組み込み`lower()`とJavaScriptの大小変換の差を残さない。キー生成関数はcoreを正本とし、fixtureとSQLの同値性テストに含める。

`random`をページングする場合はseedをクエリ契約に含め、`seed + work_id`から決まる安定順序にする。最初の要求でserverがseedを発行する場合も、レスポンスで返して次ページが同じseedを送れる契約にする。seedなしのランダム順に`LIMIT/OFFSET`を適用する実装は認めない。seed契約を実装するまでの代替は、`random`とページングの組み合わせを明示的な4xxにすることであり、不安定なページを返すことではない。

純粋関数とSQLの同値性は、同じfixtureをメモリと実SQLiteへ投入する契約テストで確認する。固定例だけでなく生成テストを使い、少なくとも次を組み合わせる。

- 空文字、ASCII・日本語・正規化前後の文字、大小文字を含むタイトルとタグ
- タグAND/OR、prefix軸、年軸、全view
- `bookmarked`、`lastPlayedAt`、`addedAt`、`status`の全組み合わせとuser孤児行
- null、同順位、ページ境界、0件、上限件数
- 全SortId。randomは同じseedを与える
- ファセットの値と件数、スマートフォルダーの候補抽出と最終結果

比較対象は順序付きWork ID列、`total`、ファセット値と件数である。生成テストが反例を出した場合は、SQL結果へ合わせて期待値を緩めず、core契約かSQLのどちらが誤りかを決めて両方を同時に直す。`EXPLAIN QUERY PLAN`と性能計測は同値性を通したクエリに対して行い、その後にindexを決める。

### core↔SQL二重実装の統制

[ADR-0004](0004-core-functions-over-sql.md)が定めた「検索・集計・評価はcoreの純粋関数で行う」という規範のうち、coreを仕様正本とする部分は本ADRが引き継いでいる。realの実行経路をSQLへ移した結果として core と SQL に同一仕様が二重に存在するが、これは無制限に許すものではない。統制の規則を次のとおり定める。

新機能の既定はcore-firstとする。規範形は `evalSmartFolder` で、core の単一実装を fixture と real の両方が呼ぶ。SQLでの再実装は性能上の例外としてのみ認め、認可済みの例外は次の3件に閉じる。

| 例外             | 経路                                                                                                                                                                 | 性能理由                                                                                                                   | 契約テスト                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 作品検索         | `core/worksQuery.ts` の `applyWorksQuery` ↔ `WorkQueryRepository.queryWorks`                                                                                         | user条件を含む絞り込み・ソート・総件数・ページングを1つのSQLスナップショット上で決めるため。全件をメモリへ読む経路を避ける | `server/tests/real/worksQueryContract.test.ts`                                                                       |
| 軸ファセット集計 | `core/axisFacets.ts` の `buildAxisFacets` ↔ `WorkQueryRepository.getAxisFacets`                                                                                      | 値ごとの件数・総時間・代表カバーを全件取得なしに集計するため                                                               | 同上（ファセット値と件数の同値検証）                                                                                 |
| DLsite通知の集計 | `core/dlsiteNotifications.ts` の `summarizeDlsiteNotifications` ↔ `WorkQueryRepository.getDlsiteNotificationSummary`・`WorkQueryRepository.queryDlsiteNotifications` | 件数集計をSQLで完結させるため。core関数を呼ぶには作品行を全件展開する必要があり、集計クエリの利点が失われる                | `server/tests/dlsiteNotifications.test.ts`（fixture↔realの同値検証）・`server/tests/real/worksQueryContract.test.ts` |

各例外の内側でSQL固有の表現になっている断片は、独立した例外として数えない。作品検索の内訳は、RJ/VJコード正規化のCASE式、randomソートのローテーション、`RECENT_VIEW_WINDOW_DAYS` による recent view の期間判定、タグとresumeのEXISTS断片である。これらはSQLフラグメント生成を1モジュールへ集約して同期リスクを下げる。DLsite通知の集計では、述語 `isRjCodeMissing`・`isDlsiteFetchFailed` に対応するCASE式がこれにあたる。

スマートフォルダーは二重実装ではない。最終評価の `evalSmartFolder` は fixture と real の両方が呼ぶ単一実装であり、SQLの候補抽出は本ADRが定めた2段階評価の第1段にあたる。

例外を増やすには、性能上の必要性を具体的に述べられること、fixture↔realの契約テストがあることの2つを満たしたうえで、本ADRの改訂を必須とする。この2条件を言えないSQL再実装は例外ではなく逸脱として扱い、core化する。

core と SQL で共有する定数・述語は core または shared から export して import する。値やロジックを両側へ書き写さない。SQLの式としてしか表現できないものは、対応するcore関数への参照をコメントで明記し、契約テストで同値を担保する。

タイトルとタグの検索キー・ソートキーに `localeCompare` を使わない規則は、作品検索とファセット集計が返す順序、およびその順序をクライアントが再現・再ソートする経路までを対象とする。ライブラリ外のファイル名一覧（ファイルモードのファイラー表示）は対象外とし、OSのファイラーに近い順序を優先してよい。

### Work・Playlist・TrackのID

Work、Playlist、Trackはそれぞれ不透明なUUIDを持つ。

- Work IDは既存の`.meta.json.id`（現行は `mimimilli.json`。[ADR-0010](0010-meta-file-rename-mimimilli-json.md)）を継続して使う
- Playlistへ`id`、Trackへ`id`を追加し、新規採番は`crypto.randomUUID()`によるUUID v4とする
- IDをパス、タイトル、配列index、ファイル名から導出しない。並べ替え、改名、移動、区間変更ではIDを変えない
- 各種類のIDはライブラリ全体で一意とする
- `defaultPlaylist`の名前参照は`defaultPlaylistId`へ移し、Playlistの改名で参照が壊れないようにする

メディアの意味が変わるファイル差し替えでTrack IDを維持するか、新しいTrackとして採番するかは編集操作が明示する。単なるパス変更やタイトル変更では維持する。自動的な内容推測でIDを付け替えない。

#### レガシーメタの手動移行

Playlist/Track IDの欠落、`defaultPlaylist`（名前参照）の残存、`defaultPlaylistId`の未設定は、通常スキャンでは修正しない。ユーザーが管理する`mimimilli.json`を勝手に書き換えないため、これらは独立した手動移行として行う。

**対象**

- `playlists[].id`または`tracks[].id`が欠落しているメタ
- `defaultPlaylist`（文字列）が残り、`defaultPlaylistId`が未設定または不正なメタ

**事前バックアップ**

- ライブラリルート全体、または対象の`mimimilli.json`を含むディレクトリを、移行前にファイルコピーまたはアーカイブで退避する
- 配布開始後はuser DBも`VACUUM INTO`等でスナップショットを取る（本ADR「バックアップと配布開始条件」参照）

**手順**

1. ライブラリルートと対象メタの読取可否を確認する
2. バックアップを作成する
3. 各メタについて、Work IDは維持し、Playlist/Trackへ`crypto.randomUUID()`でIDを付与し、`defaultPlaylist`を`defaultPlaylistId`へ置き換える（同名Playlistが複数ある場合は名前ではなく付与したIDで参照する）
4. 厳格スキーマ（`metaFileSchema`）で検証できることを確認する
5. 通常スキャンを実行し、対象作品が`error`にならず登録されることを確認する

**完了判定**

- ライブラリ内の全`mimimilli.json`がスキーマ検証を通る
- Work・Playlist・Trackの各IDがライブラリ全体で一意である
- `defaultPlaylist`キーが残っていない
- スキャンがメタファイルを変更せず（重複修復のみが書込みを行う状態で）全作品を登録できる

#### スキャン時の重複ID修復

外部編集やコピーにより、Work・Playlist・TrackのUUIDがライブラリ全体で重複した場合、スキャンは継続的な不変条件の維持として修復する。一回きりの移行ではなく、以降もスキャンのたびに実行する。

**対象ID種**

- Work ID（`mimimilli.json.id`）
- Playlist ID（`playlists[].id`）
- Track ID（`playlists[].tracks[].id`）

いずれもライブラリ全体で一意でなければならない。Work IDが重複した後続メタは、Work IDに加え配下のPlaylist IDとTrack IDをすべて再採番する。Playlist IDまたはTrack IDだけが重複した場合は、先に現れた要素が所有し、後続要素のみ再採番する。

**安定順と帰属**

- 修復前にメタパスを正規化した安定順（`naturalCompare`）で列挙し、最初の1件を各IDの所有者とする
- 元Work IDに紐づくブックマーク、履歴、resumeは最初のWorkだけに帰属する。複製側へコピーしない
- Playlist・Trackの重複で既存resumeが曖昧な場合も、最初の要素へ帰属させる

**原子的書込み**

- 修復内容は一時ファイルへ書き、`rename`で置き換える
- 書込み失敗時は一時ファイルを削除し、元ファイルを残す

**外部編集との競合**

- 修復判定時に読み取った本文と、書込み直前の本文が一致しない場合は外部編集とみなし、上書きしない
- 競合を検出したパスはログに記録し、当該スキャンではそのファイルの修復をスキップする
- 外部編集を検出したメタは当該スキャンでは登録しない。既存作品は`error`状態、新規作品はスキャン結果のエラーとして計上する。スキャンは継続し、次回スキャンで再評価する

**失敗時の復旧**

- 修復が完了しなかったメタはスキーマ検証または重複検出で`error`となり、次回スキャンで再試行される
- ユーザーがバックアップから手動で戻した場合、次回スキャンはバックアップ内容を正として再評価する
- 部分書込みで破損した場合は、事前バックアップから当該`mimimilli.json`を復元する

実装は通常スキャンのメタ読取り1回に統合し、修復専用の二重read・内容ハッシュ・manifestは持たない。

### resume v2

作品IDはAPI resourceと保存行のキーに残し、resume本文を次に変更する。

```ts
{
  playlistId: string;
  trackId: string;
  offsetSec: number;
}
```

`offsetSec`はTrack区間の先頭からの相対秒である。保存時と読出し時に、PlaylistがWorkに属すること、TrackがPlaylistに属すること、offsetがTrackの再生可能区間内であることを検証する。IDを解決できないresumeは無効として再生へ適用せず、index、名前、ファイルパスから推測して復旧しない。

Workが`missing`またはcatalog再構築中で解決できない場合も、user DBのresume行は削除しない。同じWork・Playlist・Track IDが再びcatalogへ現れれば再接続する。Workは存在するがPlaylistまたはTrack IDが変わった場合も、行は診断と外部編集の巻き戻しに備えて保持できるが、解決できない間はAPI上の有効resumeとして返さない。次の有効resume保存で置き換える。

resume v1からは、`resume_track_index`で旧デフォルトPlaylistのTrackを選び、ファイル絶対秒の`resume_position`からTrackの`start`を引いて`offsetSec`へベストエフォートで変換する。index不正、区間外、メタ不在などで変換できない値は捨て、ログには件数だけを残す。0秒を「resumeなし」としていた既存行はv2行を作らない。

CAS、revision、端末間の競合解決はDRAFT-22のデバイス間同期へ着手するまで導入しない。現在は単一serverプロセス内の書き込み順を直列化でき、同期transportも端末identityも競合ポリシーも決まっていない。この段階でrevisionだけを追加すると、後で必要な「新しい時刻を優先」「再生の進んだ位置を優先」「明示的な巻き戻しを優先」のどれにも適合しない可能性があるためである。

### バックアップと配布開始条件

開発中はuser DBもスキーマ世代不一致で再作成できるため、user migration前のバックアップを必須にしない。配布開始までに、順序付きforward migration、migration前スナップショット、スナップショットからの復元検証を揃える。

WAL中の`.sqlite`本体だけをファイルコピーしてはならない。`-wal`に未checkpointの更新があるためである。スナップショットは書き込みを止めて`VACUUM INTO`で作り、別データルートで開いて`PRAGMA integrity_check`とserverからの読出しを確認する。将来`bun:sqlite`がSQLite Online Backup APIを直接公開し、Windows実機で同じ復元検証を通した場合は置き換えてよい。`Database.serialize()`でDB全体をメモリへ載せる方式は、大規模catalogでメモリ上限がDBサイズに比例するため既定にしない。

### 旧単一DBからの移行順序

初回移行は通常起動と分け、migration markerがある間はAPIを提供しない。旧DBは全工程が終わるまで削除・改名しない。

1. 旧DB、ライブラリルート、空き容量、対象メタの読取可否をpreflightする
2. 旧DBを`VACUUM INTO`でバックアップする
3. 手動移行手順（上記「レガシーメタの手動移行」）に従い、Playlist・Track IDと`defaultPlaylistId`をメタへ付与する
4. 一時パスにuser DBとcatalog DBを構築する。resume v1はベストエフォートで変換し、変換できなかった件数だけをログへ残す
5. 新2DBをATTACHした状態で行数、重複ID、代表的な検索・ソート・ページングの整合性を検査する
6. `catalog.sqlite.next`と`user.sqlite.next`を最終パスへ切り替え、migration markerを完了にしてAPI提供を始める

migration markerに各工程の完了状態を記録し、途中停止後も同じ入力から再実行できるようにする。外部編集を検出したメタや整合性検査に失敗したDBは切り替えない。

## 帰結

- 開発中はcatalog DBとuser DBを削除・再構築できる。配布開始までに、user DBの順序付きforward migration、migration前スナップショット、復元検証が必要になる
- DBの物理分離により、catalog再構築がuserデータに触れる経路をなくせる
- user条件を含む一覧をATTACH JOINで完結でき、正しい総件数とページ境界を保ったままSQL化できる
- catalogとuserをまたぐWALトランザクションへ原子性を期待できないため、書き込み所有者の分離と冪等な回復処理が必要になる
- fixtureとcore純粋関数は残るが、realの本番検索経路では参照実装になる。SQLとの一致は契約テストで保証する
- 日本語向けソートキーの規則を変える場合は、coreのキー生成関数を差し替えてcatalogを再スキャンすればよい。user DBのmigrationは不要である
- `.meta.json`（現行は `mimimilli.json`。[ADR-0010](0010-meta-file-rename-mimimilli-json.md)）のID移行は時間とバックアップ領域を使う。代わりに、プレイリスト編集後もresumeが配列indexへ誤接続しなくなる
- missing中のWorkとcatalog再構築でuser状態を削除しないため、user DBにはcatalogに存在しない行が正常に残る
- メタへアクセスできない旧missing Workは、新しいcatalogのmissing一覧から一時的に消える。同じWork UUIDのメタが戻ればuser状態を再接続し、ID付与後に一覧へ戻る
- CAS/revisionは同期要件と一緒に決める。resume v2の導入だけでは競合制御を増やさない
- DB層の`bun:sqlite`化に伴い、開発時のserver実行ランタイムもNodeからBunへ移行する。これは[ADR-0007](0007-bun-distribution-runtime.md)の帰結を開発環境まで具体化するものである
- [ADR-0003](0003-no-db-migrations.md)は廃止する。開発中のDB再構築方針を引き継ぎ、配布開始までにuser DBだけmigrationへ移行する
- [ADR-0004](0004-core-functions-over-sql.md)は廃止する。core純粋関数を仕様参照として残す部分だけを引き継ぎ、realの検索・集計・ページングはSQLへ移す
- DRAFT-25のSQL移行、DRAFT-26のresume・ID、DRAFT-27のDB分離とmigrationについて、決定の正本は本ADRとする。各ドラフトを編集できる段階で重複説明を本ADRへの参照へ置き換える
