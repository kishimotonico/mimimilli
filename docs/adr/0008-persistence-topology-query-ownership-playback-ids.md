# ADR-0008: 永続化トポロジー・検索所有権・再生IDを分離する

- ステータス: 承認
- 日付: 2026-07-19
- 関連: [ADR-0003](0003-no-db-migrations.md)、[ADR-0004](0004-core-functions-over-sql.md)、[ADR-0007](0007-bun-distribution-runtime.md)、[ADR-0017](0017-meta-source-projection-and-work-identity.md)（Work・Playlist・Track IDの一意性とWork ID重複の扱いを改訂）、[ADR-0021](0021-custom-sqlite-migration-executor.md)・[ADR-0023](0023-in-place-migration-simplification.md)（マイグレーションとバックアップの運用を改訂）、[ADR-0025](0025-source-mutation-projection-read-separation.md)

## 文脈

現行SQLiteは、`.meta.json`（メタファイル名は [ADR-0010](0010-meta-file-rename-mimimilli-json.md) により `mimimilli.json` へ変更）とファイル走査から戻せる作品カタログ、プローブ結果のキャッシュ、設定・ブックマーク・再生状態を1ファイルに置いている。現在の開発フェーズでは、ユーザーの保存データを含む破壊的変更を許容しており、スキーマ世代が合わないDBは再作成できる。一方、配布を始めて作者以外のユーザーのデータを預かる段階では、userデータを保ったまま更新する仕組みが必要になる。

DBを分ける主目的は、catalog再構築がuserデータに触れる経路を物理的に無くし、再構築処理を単純にすることである。

作品一覧はrealアダプタでも全件をメモリへ読み、`core/worksQuery`で検索・ソート・ページングする。30,000作品を対象にすると、この方法ではページングしても全件取得の費用が残る。一方、`bookmarked`、`lastPlayedAt`、`addedAt`は再構築可能な作品情報と異なる寿命を持つため、DBを分けるだけでは、それらを使う絞り込み・ソート・ページングを正確に行えない。

現在のresumeは作品IDに対する`{trackIndex, position}`である。`position`は音声ファイルの絶対秒で、トラックの並べ替えや区間変更に耐えない。PlaylistとTrackには安定IDがなく、既存`.meta.json`へIDを追加するには、ユーザーが管理するファイルを一括変更する移行が必要になる。

[ADR-0007](0007-bun-distribution-runtime.md)のスパイクにより、配布ランタイムはBun、SQLiteは`bun:sqlite`、データルートはWindowsで`%LOCALAPPDATA%\mimimilli`となった。`bun:sqlite`による2DB同時接続と`ATTACH`も実測済みである。本ADRではこの制約を前提に、データの帰属、DB間の読み方、検索仕様の置き場、ID移行、バックアップをまとめて決める。

## 決定

### データの分類

分類は列の値を失ったときの回復元で決める。

- catalog: `.meta.json`（現行は `mimimilli.json`。[ADR-0010](0010-meta-file-rename-mimimilli-json.md)）またはファイル走査から再構築できる
- user: DBが正本であり、再スキャンでは同じ値に戻らない
- 派生キャッシュ: catalogまたはファイルから計算し直せる。失っても意味上のデータは失わない

テーブルは次のように分類する。

| 分類           | テーブル・列                                                                                                                                                                                                              | 回復元・扱い                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| catalog        | `works` のメタ列（`id`・`title`・`cover_image`・`default_playlist_id`・`created_at`・`urls_json`）、`status`・`physical_path`・`error_message`、Playlist・Track、`tags`・`work_tags`、`work_dlsite`、`identity_conflicts` | `mimimilli.json` とファイル走査の結果から再構築する。Work ID は `mimimilli.json.id`（[ADR-0010](0010-meta-file-rename-mimimilli-json.md)）                    |
| user           | `work_states`（`added_at`・`bookmarked`・`last_played_at`・resume v2）、`tag_prefixes`、`smart_folders`、`scan_candidate_exclusions`、`app_settings` の `root_folder`・`tag_prefixes_seeded`                              | DBが正本。`added_at` は初回登録日時で、再構築で現在時刻へ変えてはならない。`tag_prefixes_seeded` は初期値の再投入でユーザーの削除を取り消さないために保持する |
| 派生キャッシュ | `works.total_duration_sec`、検索・ソート用のキー列、`audio_probe_cache`、`scan_state`（`last_scan_time` など）                                                                                                            | プレイリスト区間と音声プローブ、スキャンから再計算する                                                                                                        |

今後`app_settings`へキーを追加するときは、キーごとにuserか派生キャッシュかを宣言する。寿命の異なる値を未分類のまま汎用KVへ追加しない。

### 2DBの物理構成と接続

データルートの`db/catalog.sqlite`と`db/user.sqlite`へ物理分離する。catalog DBにはcatalogと派生キャッシュを置き、user DBにはuserだけを置く。両方をWALモードで使う。

新しい論理配置は次の通りとする。

| DB               | 主なデータ                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog.sqlite` | Workのメタ・走査状態、Playlist・Track関係、TagとWork-Tag関係、DLsite状態、音声プローブ結果、スキャン状態、検索用の派生キー                    |
| `user.sqlite`    | Workごとの`addedAt`・`bookmarked`・`lastPlayedAt`、resume v2、設定、タグprefix、スマートフォルダー、候補の除外、schema version、migration履歴 |

この2DBの外に、DLsite取得キャッシュだけを独立ファイル`db/dlsite-cache.sqlite`として置く（`MIMIMILLI_DLSITE_CACHE_DB`で差し替え可）。中身は外部サイトのHTMLスナップショット・取得失敗記録・カバー画像BLOBで、catalogからもローカルファイルからも計算し直せないため上の3分類のどれにも当てはまらない。失っても意味上のデータは失わず、実HTTPへ出れば埋め直せる、という一方向の性質だけを持つ。catalog DBへ同居させると、catalog再構築のたびにこのBLOBを巻き添えで捨て、再構築のたびにDLsiteへ再アクセスすることになる。寿命がcatalogと無関係なので物理的に分ける。この例外はDLsiteキャッシュに限る。「削除・再生成できる」ことを理由に、catalogから計算し直せる派生キャッシュを独立ファイルへ切り出してよいわけではない。

このDBは`DlsiteCache`（`dlsiteCache.ts`）が自前の`CREATE TABLE IF NOT EXISTS`で作り、[ADR-0021](0021-custom-sqlite-migration-executor.md)のmigration executorの対象外でschema versionも持たない。したがってスキーマ不一致はfail-fastで検出されず、forward migrationも書かない。テーブル定義を変えたときは、ファイルごと削除して起動時に空で作り直すのが正しい対処になる。捨てる前に内容を残したい場合は`pnpm --filter @mimimilli/server dlsite-cache -- export --dir <path>`でHTMLスナップショットをアーカイブし、再作成後に`import --dir`で戻す（取得失敗記録とカバー画像はexport対象外で、再取得に任せる）。運用コマンドの詳細は[dlsite.md](../dlsite.md)を正とする。

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

catalog DBとuser DBは、どちらも順序付きのforward migrationをin-placeで適用する。適用方式とバックアップの詳細は [ADR-0021](0021-custom-sqlite-migration-executor.md)・[ADR-0023](0023-in-place-migration-simplification.md) を正とする。catalog DBは再構築できる投影なので、破棄してfull scanで作り直してもよい。user DBは削除・再作成しない。

スキーマの正本は1系統にし、現行のように実行用DDLと型用スキーマを手動で二重管理しない。migrationには、Bun SQLiteで実行できる生成済みmigration SQLをリポジトリへ保存して使う。生成ツールが`bun:sqlite`と整合しない場合だけ、版管理した手書きSQLを代替にできる。その場合は空DBへ適用した実スキーマとの一致テストを必須とする。

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

新機能の既定はcore-firstとする。規範形は `evalSmartFolderRules` で、core の単一実装を fixture と real の両方が呼ぶ。SQLでの再実装は性能上の例外としてのみ認め、認可済みの例外は次の3件に閉じる。

| 例外             | 経路                                                                                                                                                                 | 性能理由                                                                                                                   | 契約テスト                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 作品検索         | `core/worksQuery.ts` の `applyWorksQuery` ↔ `WorkQueryRepository.queryWorks`                                                                                         | user条件を含む絞り込み・ソート・総件数・ページングを1つのSQLスナップショット上で決めるため。全件をメモリへ読む経路を避ける | `server/tests/real/worksQueryContract.test.ts`                                                                       |
| 軸ファセット集計 | `core/axisFacets.ts` の `buildAxisFacets` ↔ `WorkQueryRepository.getAxisFacets`                                                                                      | 値ごとの件数・総時間・代表カバーを全件取得なしに集計するため                                                               | 同上（ファセット値と件数の同値検証）                                                                                 |
| DLsite通知の集計 | `core/dlsiteNotifications.ts` の `summarizeDlsiteNotifications` ↔ `WorkQueryRepository.getDlsiteNotificationSummary`・`WorkQueryRepository.queryDlsiteNotifications` | 件数集計をSQLで完結させるため。core関数を呼ぶには作品行を全件展開する必要があり、集計クエリの利点が失われる                | `server/tests/dlsiteNotifications.test.ts`（fixture↔realの同値検証）・`server/tests/real/worksQueryContract.test.ts` |

各例外の内側でSQL固有の表現になっている断片は、独立した例外として数えない。作品検索の内訳は、RJ/VJコード正規化のCASE式、randomソートのローテーション、`RECENT_VIEW_WINDOW_DAYS` による recent view の期間判定、タグとresumeのEXISTS断片である。これらはSQLフラグメント生成を1モジュールへ集約して同期リスクを下げる。DLsite通知の集計では、述語 `isRjCodeMissing`・`isDlsiteFetchFailed` に対応するCASE式がこれにあたる。

スマートフォルダーは二重実装ではない。最終評価の `evalSmartFolderRules`（`core/smartFolder.ts`）は fixture と real の両方が呼ぶ単一実装であり、SQLの候補抽出は本ADRが定めた2段階評価の第1段にあたる。

例外を増やすには、性能上の必要性を具体的に述べられること、fixture↔realの契約テストがあることの2つを満たしたうえで、本ADRの改訂を必須とする。この2条件を言えないSQL再実装は例外ではなく逸脱として扱い、core化する。

core と SQL で共有する定数・述語は core または shared から export して import する。値やロジックを両側へ書き写さない。SQLの式としてしか表現できないものは、対応するcore関数への参照をコメントで明記し、契約テストで同値を担保する。

タイトルとタグの検索キー・ソートキーに `localeCompare` を使わない規則は、作品検索とファセット集計が返す順序、およびその順序をクライアントが再現・再ソートする経路までを対象とする。ライブラリ外のファイル名一覧（ファイルモードのファイラー表示）は対象外とし、OSのファイラーに近い順序を優先してよい。

### Work・Playlist・TrackのID

Work、Playlist、Trackはそれぞれ不透明なUUIDを持つ。

- Work IDは既存の`.meta.json.id`（現行は `mimimilli.json`。[ADR-0010](0010-meta-file-rename-mimimilli-json.md)）を継続して使う
- Playlistへ`id`、Trackへ`id`を追加し、新規採番は`crypto.randomUUID()`によるUUID v4とする
- IDをパス、タイトル、配列index、ファイル名から導出しない。並べ替え、改名、移動、区間変更ではIDを変えない
- Work IDはライブラリ全体で一意とする。Playlist IDとTrack IDはWork配下で一意とする（[ADR-0017](0017-meta-source-projection-and-work-identity.md)）
- 既定Playlistは名前参照ではなく`defaultPlaylistId`で指し、Playlistの改名で参照が壊れないようにする

メディアの意味が変わるファイル差し替えでTrack IDを維持するか、新しいTrackとして採番するかは編集操作が明示する。単なるパス変更やタイトル変更では維持する。自動的な内容推測でIDを付け替えない。

#### Work IDの重複

外部編集やコピーでWork IDが重複した場合、scanは`mimimilli.json`を書き換えず`identity_conflict`として診断する。修復の方針は [ADR-0017](0017-meta-source-projection-and-work-identity.md) の「Work identity、移動、複製」に従う。

#### スキャン時の退避メタ回収

作品登録解除（`unregisterWork`）は、メタ正本を `.<正本名>.unregistering` へ rename して退避したあと catalog 行を削除し、最後に退避ファイルを削除する。プロセス停止により退避だけ残った場合、次回スキャンで回収する。専用コマンドや常駐処理は持たない。

**検知**

- ファイル走査（`walk`）で、先頭が `.`、末尾が `.unregistering`、その間の文字列がメタファイル名（`mimimilli.json` または `*.mimimilli.json`）であるファイルを退避メタとして収集する
- 退避メタはメタ本体の列挙（`metaPaths`）には入れない

**回収規則**

退避ファイルの中身から Work ID を読む（`id` フィールドが string）。読めない・`id` が取れない場合は上書きも削除もせずログに記録してスキップする。

Work ID が読めた場合、判定順は次のとおり。

1. **正本と退避が併存** → 正本を優先し、退避を削除する（登録解除完了後にユーザーが同じフォルダーを再登録したケース）
2. **正本が無く、catalog に該当 Work が存在する** → 退避を正本へ rename して復元する（登録解除未完了とみなす）。復元した正本は当該スキャンの `metaPaths` 等へ反映し、同じ回の登録フェーズで処理する
3. **正本が無く、catalog に該当 Work が存在しない** → 退避を削除する（登録解除は実質完了しており掃除だけ残った状態）

catalog の存在確認は `CatalogWorkRepository.workExists(id)` を使う。JS例外パスでの `restoreStagedMeta`（未完了の登録解除は復元）と一貫させる。

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

resume自体のCAS、revision、端末間の競合解決はDRAFT-22のデバイス間同期へ着手するまで導入しない。現在は単一serverプロセス内の書き込み順を直列化でき、同期transportも端末identityも競合ポリシーも決まっていない。この段階でrevisionだけを追加すると、後で必要な「新しい時刻を優先」「再生の進んだ位置を優先」「明示的な巻き戻しを優先」のどれにも適合しない可能性があるためである。

### バックアップ

起動時のバックアップ・検証・in-place適用の運用は [ADR-0023](0023-in-place-migration-simplification.md) を正とする。

WAL中の`.sqlite`本体だけをファイルコピーしてはならない。`-wal`に未checkpointの更新があるためである。スナップショットは書き込みを止めて`VACUUM INTO`で作り、別接続で`PRAGMA integrity_check`を通す。スキーマ固定リストによる読出し検証は行わない（pre-migration スナップショットは旧スキーマのため、現行スキーマを要求すると矛盾する）。将来`bun:sqlite`がSQLite Online Backup APIを直接公開し、Windows実機で同じ復元検証を通した場合は置き換えてよい。`Database.serialize()`でDB全体をメモリへ載せる方式は、大規模catalogでメモリ上限がDBサイズに比例するため既定にしない。

## 帰結

- catalog DBは破棄してfull scanで再構築できる。user DBは順序付きforward migrationで更新し、削除・再作成しない
- DBの物理分離により、catalog再構築がuserデータに触れる経路をなくせる
- user条件を含む一覧をATTACH JOINで完結でき、正しい総件数とページ境界を保ったままSQL化できる
- catalogとuserをまたぐWALトランザクションへ原子性を期待できないため、書き込み所有者の分離と冪等な回復処理が必要になる
- fixtureとcore純粋関数は残るが、realの本番検索経路では参照実装になる。SQLとの一致は契約テストで保証する
- 日本語向けソートキーの規則を変える場合は、coreのキー生成関数を差し替えてcatalogを再スキャンすればよい。user DBのmigrationは不要である
- Playlist・TrackのIDを持つため、プレイリスト編集後もresumeが配列indexへ誤接続しなくなる
- missing中のWorkとcatalog再構築でuser状態を削除しないため、user DBにはcatalogに存在しない行が正常に残る
- CAS/revisionは同期要件と一緒に決める。resume v2の導入だけでは競合制御を増やさない
- DB層の`bun:sqlite`化に伴い、開発時のserver実行ランタイムもNodeからBunへ移行する。これは[ADR-0007](0007-bun-distribution-runtime.md)の帰結を開発環境まで具体化するものである
- [ADR-0003](0003-no-db-migrations.md)は廃止する。DBの更新はforward migrationで行う（ADR-0021・ADR-0023）
- [ADR-0004](0004-core-functions-over-sql.md)は廃止する。core純粋関数を仕様参照として残す部分だけを引き継ぎ、realの検索・集計・ページングはSQLへ移す
