# ADR-0008: 永続化トポロジー・検索所有権・再生IDを分離する

- ステータス: 承認
- 日付: 2026-07-19
- 関連: [ADR-0003](0003-no-db-migrations.md)、[ADR-0004](0004-core-functions-over-sql.md)、[ADR-0007](0007-bun-distribution-runtime.md)、backlog TASK-71、DRAFT-25、DRAFT-26、DRAFT-27、[Bun配布スパイク](../../scripts/spike/bun-distribution/README.md)

## 文脈

現行SQLiteは、`.meta.json`とファイル走査から戻せる作品カタログ、プローブ結果のキャッシュ、失ってはいけない設定・ブックマーク・再生状態を1ファイルに置いている。スキーマ更新時はDB全体を削除する方針なので、作品数や利用期間が増えるほどアプリ更新による損失が大きくなる。

作品一覧はrealアダプタでも全件をメモリへ読み、`core/worksQuery`で検索・ソート・ページングする。30,000作品を対象にすると、この方法ではページングしても全件取得の費用が残る。一方、`bookmarked`、`lastPlayedAt`、`addedAt`は再構築可能な作品情報と異なる寿命を持つため、DBを分けるだけでは、それらを使う絞り込み・ソート・ページングを正確に行えない。

現在のresumeは作品IDに対する`{trackIndex, position}`である。`position`は音声ファイルの絶対秒で、トラックの並べ替えや区間変更に耐えない。PlaylistとTrackには安定IDがなく、既存`.meta.json`へIDを追加するには、ユーザーが管理するファイルを一括変更する移行が必要になる。

[ADR-0007](0007-bun-distribution-runtime.md)のスパイクにより、配布ランタイムはBun、SQLiteは`bun:sqlite`、データルートはWindowsで`%LOCALAPPDATA%\Mimikago`となった。`bun:sqlite`による2DB同時接続と`ATTACH`も実測済みである。本ADRではこの制約を前提に、データの帰属、DB間の読み方、検索仕様の置き場、ID移行、バックアップをまとめて決める。

## 決定

### データの分類

分類は列の値を失ったときの回復元で決める。

- catalog: `.meta.json`またはファイル走査から再構築できる
- user: DBが正本であり、再スキャンでは同じ値に戻らない
- 派生キャッシュ: catalogまたはファイルから計算し直せる。失っても意味上のデータは失わない

現行`schema.ts`と`db.ts`の全テーブル・全列を次のように分類する。複数列を記した行も、列名を省略していない。

| 現行テーブル        | 現行列                                                                                  | 分類           | 回復元・扱い                                                       |
| ------------------- | --------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------ |
| `works`             | `id`                                                                                    | catalog        | `.meta.json.id`。Workの安定ID                                      |
| `works`             | `title`, `cover_image`, `default_playlist`, `created_at`, `urls_json`, `playlists_json` | catalog        | `.meta.json`                                                       |
| `works`             | `status`, `physical_path`, `error_message`                                              | catalog        | ファイル走査とメタ検証の結果                                       |
| `works`             | `total_duration_sec`                                                                    | 派生キャッシュ | プレイリスト区間と音声プローブから再計算                           |
| `works`             | `added_at`                                                                              | user           | 初回登録日時。再構築で現在時刻へ変えてはならない                   |
| `works`             | `bookmarked`, `last_played_at`                                                          | user           | ユーザー操作と再生履歴                                             |
| `works`             | `resume_position`, `resume_track_index`                                                 | user           | resume v1。移行後はresume v2へ置換                                 |
| `tags`              | `id`, `name`                                                                            | catalog        | 正規化した`.meta.json.tags`から再構築。`id`はDB内の代理キー        |
| `work_tags`         | `work_id`, `tag_id`                                                                     | catalog        | Workと再構築済みTagの関係                                          |
| `work_dlsite`       | `work_id`, `state_json`                                                                 | catalog        | 現行実装は全更新経路で`dlsite`を`.meta.json`にも書くため再構築可能 |
| `tag_prefixes`      | `id`, `prefix`, `label`, `color`, `show_as_axis`, `protected`                           | user           | ユーザーが編集する分類軸定義。`id`は表示順も保持する               |
| `app_settings`      | `key`, `value`のうち`root_folder`                                                       | user           | ユーザーが選んだライブラリルート                                   |
| `app_settings`      | `key`, `value`のうち`tag_prefixes_seeded`                                               | user           | 初期値を再投入してユーザーの削除を取り消さないため保持             |
| `app_settings`      | `key`, `value`のうち`last_scan_time`                                                    | 派生キャッシュ | 最後に完了したスキャンから再生成する運用情報                       |
| `search_presets`    | `id`, `name`, `query`, `tag_filters_json`, `sort_id`                                    | user           | ユーザーが保存した検索条件                                         |
| `smart_folders`     | `id`, `name`, `rules_json`, `sort`, `created_at`                                        | user           | ユーザーが作成したフォルダー定義                                   |
| `audio_probe_cache` | `path`, `size`, `mtime_ms`, `duration_sec`                                              | 派生キャッシュ | 音声ファイルを再プローブして回復                                   |

今後`app_settings`へキーを追加するときは、キーごとにuserか派生キャッシュかを宣言する。寿命の異なる値を未分類のまま汎用KVへ追加しない。

### 2DBの物理構成と接続

データルートの`db/catalog.sqlite`と`db/user.sqlite`へ物理分離する。catalog DBにはcatalogと派生キャッシュを置き、user DBにはuserだけを置く。両方をWALモードで使う。

新しい論理配置は次の通りとする。

| DB               | 主なデータ                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `catalog.sqlite` | Workのメタ・走査状態、Playlist・Track関係、TagとWork-Tag関係、DLsite状態、音声プローブ結果、スキャン状態、検索用の派生キー                 |
| `user.sqlite`    | Workごとの`addedAt`・`bookmarked`・`lastPlayedAt`、resume v2、設定、タグprefix、検索プリセット、スマートフォルダー、user DBのmigration履歴 |

catalog接続を`main`として開き、user DBを`user`スキーマ名で`ATTACH`する。作品一覧は`main`の作品・タグと`user`の作品状態を同じSQL文でJOINする。`addedAt`を含むuser側の作品状態は、作品をcatalogへ登録する前に冪等なINSERTで作る。起動時の整合性検査で、catalogに存在するのにuser状態がないWorkを検出した場合は、一覧から黙って除外したり現在時刻を補ったりせず、診断可能な整合性エラーとして止める。

PlaylistとTrackは`.meta.json`の入れ子構造を正本としつつ、IDと所属関係をcatalog DBの関係表にも展開する。この関係表はcatalogであり、再スキャンで作り直せる。resume v2はuser DBで`work_id`を主キーとし、`playlist_id`、`track_id`、`offset_sec`を保持する。

user DBにはcatalog DBを参照する外部キーを作らない。catalogの削除や再作成からuser状態を切り離し、`ON DELETE CASCADE`も使わない。通常スキャンでは見つからないWorkのcatalog行を`missing`にするため、検索の`missing`表示は維持できる。catalog DBをファイルごと再構築してmissing中のcatalog行がなくなっても、user状態は孤児として残す。同じWork UUIDが再び現れたときにその状態を再接続する。

WALモードでは、ATTACHした複数DBへの書き込みは各DB内では原子的だが、DB集合としては原子的ではない。このため、通常処理でcatalogとuserを同じトランザクションから同時更新しない。スキャンはcatalog、設定・ブックマーク・再生状態はuserという単一所有者へ書く。初回登録のように両方が必要な処理は、先にuserへ冪等に書き、次にcatalogへ書く。途中停止時は再実行で収束させる。

接続候補は次の理由で選ばなかった。

| 候補                              | 判断                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| user状態をcatalogへ投影同期       | 不採用。正本が2か所になり、同期漏れが誤った検索結果やページ境界として現れる                        |
| catalog取得後にuser状態を合成     | 不採用。user条件での絞り込み・ソート後に正しい`LIMIT/OFFSET`を適用できず、結局全件取得が必要になる |
| 単一DBでcatalogテーブルだけ再構築 | 不採用。再構築対象の指定ミスやmigration失敗がuserデータへ到達し、物理分離による保護がない          |
| catalogからuserを`ATTACH`してJOIN | 採用。1つのSQLスナップショット上でuser条件を含む検索・ソート・件数・ページ境界を決められる         |

user DBは順序付きのforward migrationで更新し、更新前に必ずスナップショットを取る。catalog DBは互換migrationを持たず、スキーマ世代が合わなければ再構築できる。スキーマの正本は1系統にし、現行のように実行用DDLと型用スキーマを手動で二重管理しない。推奨は、Bun SQLiteで実行できる生成済みmigration SQLをリポジトリへ保存し、それをcatalog作成とuser migrationの入力にする方式である。生成ツールが`bun:sqlite`と整合しない場合だけ、版管理した手書きSQLを代替にできる。その場合は空DBへ適用した実スキーマとの一致テストを必須とする。

### 検索・ソート・ページングの所有権

検索仕様はcoreが所有し、realでの実行はSQLが所有する。

- `WorksQuery`の正規化、各フィルターとソートの意味、nullの順序、同順位の扱いはcoreの契約とする
- `applyWorksQuery`、ファセット集計、スマートフォルダー評価の純粋関数はfixture実装と参照実装として残す
- realアダプタは全件を`applyWorksQuery`へ渡さず、ATTACH JOINを使ったSQLで検索、ソート、総件数、ページングを行う
- routeはクエリを検証してアダプタへ渡すだけとし、SQL断片や検索規則を持たない

作品一覧SQLは、catalog作品とuser作品状態をJOINした共通の絞り込み集合を作る。同じ集合から`COUNT(*)`と、`ORDER BY ... LIMIT ... OFFSET ...`を求める。`bookmarked`、`lastPlayedAt`、`addedAt`、resume有無・位置を使う条件も、ページング前に評価する。resume条件ではuserのresume行をcatalogのPlaylist・Track関係へJOINし、IDを解決できる行だけを有効として扱う。タグのAND/ORと軸絞り込みは`tags`、`work_tags`を使う。

SQLへ直接移せない規則は、catalog DBにcoreと同じ関数で作った検索キー・ソートキーを派生キャッシュとして保持する。それでもSQL化できないスマートフォルダー条件は、SQLで候補を減らしたあと純粋関数で最終評価できる。ただし、最終評価・ソートを終える前にSQLの`LIMIT/OFFSET`を適用してはならない。正確性を保てない条件を、近似SQLや取得後のページ内フィルターで隠さない。

全ソートは`work_id ASC`を最終タイブレーカーに加え、全順序を定義する。タイトルの検索キーとソートキーは、Unicode NFKC正規化後にUnicode既定の`toLowerCase()`を適用した文字列とする。ソートはそのUTF-8バイト列の昇順・降順で行う。coreの参照実装もUTF-8バイト列を比較し、catalogには同じ関数の結果を派生キャッシュとして保存する。配布物に外部ICU拡張は追加せず、現行の`localeCompare("ja")`はこの規則へ置き換える。部分一致検索も同じ検索キーを使い、SQLite組み込み`lower()`とJavaScriptの大小変換の差を残さない。

`random`をページングする場合はseedをクエリ契約に含め、`seed + work_id`から決まる安定順序にする。最初の要求でserverがseedを発行する場合も、レスポンスで返して次ページが同じseedを送れる契約にする。seedなしのランダム順に`LIMIT/OFFSET`を適用する実装は認めない。seed契約を実装するまでの代替は、`random`とページングの組み合わせを明示的な4xxにすることであり、不安定なページを返すことではない。

純粋関数とSQLの同値性は、同じfixtureをメモリと実SQLiteへ投入する契約テストで確認する。固定例だけでなく生成テストを使い、少なくとも次を組み合わせる。

- 空文字、ASCII・日本語・正規化前後の文字、大小文字を含むタイトルとタグ
- タグAND/OR、prefix軸、年軸、全view
- `bookmarked`、`lastPlayedAt`、`addedAt`、`status`の全組み合わせとuser孤児行
- null、同順位、ページ境界、0件、上限件数
- 全SortId。randomは同じseedを与える
- ファセットの値と件数、スマートフォルダーの候補抽出と最終結果

比較対象は順序付きWork ID列、`total`、ファセット値と件数である。生成テストが反例を出した場合は、SQL結果へ合わせて期待値を緩めず、core契約かSQLのどちらが誤りかを決めて両方を同時に直す。`EXPLAIN QUERY PLAN`と性能計測は同値性を通したクエリに対して行い、その後にindexを決める。

### Work・Playlist・TrackのID

Work、Playlist、Trackはそれぞれ不透明なUUIDを持つ。

- Work IDは既存の`.meta.json.id`を継続して使う
- Playlistへ`id`、Trackへ`id`を追加し、新規採番は`crypto.randomUUID()`によるUUID v4とする
- IDをパス、タイトル、配列index、ファイル名から導出しない。並べ替え、改名、移動、区間変更ではIDを変えない
- 各種類のIDはライブラリ全体で一意とする
- `defaultPlaylist`の名前参照は`defaultPlaylistId`へ移し、Playlistの改名で参照が壊れないようにする

メディアの意味が変わるファイル差し替えでTrack IDを維持するか、新しいTrackとして採番するかは編集操作が明示する。単なるパス変更やタイトル変更では維持する。自動的な内容推測でIDを付け替えない。

既存`.meta.json`の一括変更は、通常のスキャン時の補正ではなく、独立したユーザーデータ移行として実行する。手順は次の通りとする。

1. serverの書き込みを止め、対象メタのパス、元ハッシュ、採番後の全IDをmigration manifestへ先に確定する
2. 変更対象の全メタを、相対パスと元ハッシュを保ったままバックアップする
3. バックアップから別パスへ復元し、元ファイルと一致することを確認する
4. manifestの採番を使い、各ファイルを一時ファイルへの書き込みとrenameで置き換える
5. 全メタを新スキーマで再読込し、UUIDの形式・一意性、`defaultPlaylistId`、resume変換先を検証する
6. 成功件数、保留件数、失敗理由、変更後ハッシュをmanifestへ記録する

採番をmanifestへ先に保存するため、途中停止後も再実行は同じIDを使う。すでに変更後ハッシュになったファイルは検証だけ行い、未変更のファイルだけ処理する。元ハッシュとも変更後ハッシュとも一致しないファイルは、外部編集との競合として停止し、上書きしない。

ライブラリルートが外れているWorkはメタを書き換えられないため、移行未完了としてuser DBの移行記録に残す。同じWork UUIDのメタが再び見つかった時点で、そのファイルをバックアップしてからIDを付与する。resume v1も変換できるまで移行用の退避表に元の`position`と`trackIndex`を保持し、黙って捨てない。

スキャナが重複UUIDを見つけた場合は、正規化したメタパスの安定順で最初の1件をIDの所有者とする。

- Work IDが重複した後続メタは、新しいWork IDに加えて配下のPlaylist IDとTrack IDもすべて再採番する
- Playlist IDまたはTrack IDだけが重複した場合も、先に現れた要素が所有し、後続要素を再採番する
- 元Work IDに紐づくブックマーク、履歴、resumeは最初のWorkだけに帰属する。複製側へコピーしない
- Playlist・Trackの重複で既存resumeが曖昧な場合も、最初の要素へ帰属させる
- 重複修正にも通常移行と同じバックアップ、manifest、原子的書き換え、検証を使う

現在の`scanner.ts`のように、検出中にその場でWork IDだけをランダム再採番する処理は置き換える。スキャン順が変わってuser状態の帰属先まで変わらないよう、事前列挙と安定順を必須にする。

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

resume v1からは、`resume_track_index`で旧デフォルトPlaylistのTrackを選び、ファイル絶対秒の`resume_position`からTrackの`start`を引いて`offsetSec`へ変換する。index不正、区間外、メタ不在などで変換できない値は移行用退避表と移行報告へ残す。0秒を「resumeなし」としていた既存行はv2行を作らない。

CAS、revision、端末間の競合解決はDRAFT-22のデバイス間同期へ着手するまで導入しない。現在は単一serverプロセス内の書き込み順を直列化でき、同期transportも端末identityも競合ポリシーも決まっていない。この段階でrevisionだけを追加すると、後で必要な「新しい時刻を優先」「再生の進んだ位置を優先」「明示的な巻き戻しを優先」のどれにも適合しない可能性があるためである。

### バックアップと復元検証

WAL中の`.sqlite`本体だけをファイルコピーしてバックアップしてはならない。`-wal`に未checkpointの更新があるためである。バックアップ中はアプリの書き込みを止め、接続中のDBに対して`VACUUM INTO`を実行し、別ファイルへ一貫したSQLiteスナップショットを作る。user migration前はuser DB、旧単一DBからの初回移行前は旧DBを必ず保存する。catalogは再構築可能だが、初回の無損失移行と障害解析のため旧DBスナップショットへ含める。

将来`bun:sqlite`がSQLite Online Backup APIを直接公開し、Windows実機で同じ復元試験を通した場合は、`VACUUM INTO`から置き換えてよい。`Database.serialize()`を経由して全DBをメモリへ載せる方式は、大規模catalogでメモリ上限がDBサイズに比例するため既定にしない。

各バックアップには、作成日時、元パス、schema version、ファイルサイズ、SHA-256、主要テーブル件数を記したmanifestを付ける。作成直後に本番DBとは別の一時パスへコピーして読取専用で開き、次を検証する。

- `PRAGMA integrity_check`が`ok`
- schema versionと必要テーブルが期待どおり
- manifestの主要テーブル件数と一致
- userスナップショットでは全userレコードをZod契約で読める

復元検証に通らないバックアップではmigrationを始めない。復元手順は本番パスへの上書きを前提にせず、別データルートでserverを起動して内容を確認できる形にする。`.meta.json`の一括書き換えではSQLiteスナップショットとは別に、対象メタとハッシュmanifestも保存する。

### 旧単一DBからの移行順序

初回移行は通常起動と分け、migration markerがある間はAPIを提供しない。旧DBは全工程が終わるまで削除・改名しない。

1. 旧DB、ライブラリルート、空き容量、全メタの読取可否をpreflightする
2. 旧DBを`VACUUM INTO`でバックアップし、別パスから復元検証する
3. 変更対象メタをバックアップし、ID採番済みmigration manifestを永続化する
4. Playlist・Track IDと`defaultPlaylistId`をメタへ書き、全件を再検証する
5. 一時パスへ新しいuser DBを作り、`works.added_at`、`bookmarked`、`last_played_at`、変換済みresume、タグprefix、user設定、検索プリセット、スマートフォルダーを移す
6. 変換できないresumeとメタ不在Workをuser DBの移行用退避表へ移し、件数と理由を記録する。`last_scan_time`と音声プローブ結果は派生キャッシュなので移さなくてよい
7. 一時パスへcatalog DBを作り、更新済みメタとファイル走査から再構築する。メタへアクセスできず新ID契約を検証できない旧missing行はactiveなcatalogへコピーせず、user状態と旧DBスナップショットと移行用退避記録だけを保持する
8. 新2DBをATTACHした状態で整合性検査、user行数照合、重複ID検査、代表的な検索・ソート・ページングを実行する
9. `catalog.sqlite.next`と`user.sqlite.next`を最終パスへ移す。途中停止時はmigration markerを見て通常起動せず、旧DBとmanifestから工程を再実行する
10. 両DBを最終パスから開いて再検証したあとmarkerを完了にし、API提供を開始する

各工程は完了状態と入力・出力ハッシュをmanifestへ記録する。再実行は完了済み工程を検証して飛ばし、未完了工程だけを行う。件数不一致、外部編集、復元検証失敗を無理に補正して先へ進めない。旧DBとバックアップの自動削除期限は本ADRでは設けず、ユーザーが新構成を確認するまで保持する。

## 帰結

- catalog DBは削除・再構築できるが、user DBはmigrationと復元可能なバックアップが必要になる
- user条件を含む一覧をATTACH JOINで完結でき、正しい総件数とページ境界を保ったままSQL化できる
- catalogとuserをまたぐWALトランザクションへ原子性を期待できないため、書き込み所有者の分離と冪等な回復処理が必要になる
- fixtureとcore純粋関数は残るが、realの本番検索経路では参照実装になる。SQLとの一致は契約テストで保証する
- `.meta.json`のID移行は時間とバックアップ領域を使う。代わりに、プレイリスト編集後もresumeが配列indexへ誤接続しなくなる
- missing中のWorkとcatalog再構築でuser状態を削除しないため、user DBにはcatalogに存在しない行が正常に残る
- メタへアクセスできない旧missing Workは、新しいcatalogのmissing一覧から一時的に消える。同じWork UUIDのメタが戻ればuser状態を再接続し、ID付与後に一覧へ戻る
- CAS/revisionは同期要件と一緒に決める。resume v2の導入だけでは競合制御を増やさない
- [ADR-0003](0003-no-db-migrations.md)は廃止する。catalogを再構築する部分だけを引き継ぎ、user DBにはmigrationを導入する
- [ADR-0004](0004-core-functions-over-sql.md)は廃止する。core純粋関数を仕様参照として残す部分だけを引き継ぎ、realの検索・集計・ページングはSQLへ移す
- DRAFT-25のSQL移行、DRAFT-26のresume・ID、DRAFT-27のDB分離とmigrationについて、決定の正本は本ADRとする。各ドラフトを編集できる段階で重複説明を本ADRへの参照へ置き換える
