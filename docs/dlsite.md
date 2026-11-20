# DLsite連携

DLsiteの作品ページから情報を取得し、作品のタイトル・タグ・カバー画像・URLへ反映する機能。要件は[requirements-v4.md](requirements-v4.md) 4.4節。実装は `server/src/adapters/real/` の `dlsite.ts`（パース）、`dlsiteFetch.ts`（取得）、`dlsiteCache.ts`（キャッシュ）、`dlsiteScheduler.ts`（レート制限）、`dlsiteApply.ts`・`dlsiteMethods.ts`・`dlsiteProductResolve.ts`・`dlsiteProjection.ts` と、ジョブを管理する `server/src/dlsiteJobManager.ts` にある。API契約の正典はこのドキュメントではなく `shared/src/dlsite.ts`（Zodスキーマと、real/fixture 共通の純関数）。

## RJ/VJコードの検出

`detectRjCode`（`shared/src/dlsite.ts`）が、フォルダー名・タイトルの順で候補文字列を調べ、`RJ\d{6,8}`（大文字小文字を無視）にマッチした最初のコードを採用する。作品に紐づくRJコードが未検出のときだけ、この自動検出を試みる。

自動検出の対象はRJコードのみで、VJコードは自動検出しない。VJ作品は `PATCH /dlsite/:id` でユーザーが手動でコードを設定する。

作品ページのURLはコードのprefixでストアが分かれる。RJ（同人）は `maniax`、VJ（商業・美少女ゲーム）は `pro` で、ストアを誤ると常に404（`not_found`）になる。手動設定でVJコードが入った作品も、以降はこのprefix判定に従って `pro` のURLで取得する。

```
https://www.dlsite.com/maniax/work/=/product_id/RJ000000.html
https://www.dlsite.com/pro/work/=/product_id/VJ000000.html
```

## 取得する情報

`parseDlsiteHtml` が作品ページのHTMLから抽出するのは、タイトル、サークル名、CV（声優）一覧、ジャンルタグ一覧、年齢指定、カバー画像URL、作品URL（`DlsiteWorkInfo`、`shared/src/dlsite.ts`）。タイトルが取得できない場合は `parse_error` として扱う。ジャンルタグはリンク先が `/fs/=/genre/` または `/fsr/=/genre/` のものだけを対象にし、特集・キャンペーンへの通常リンクを除外する。年齢指定は作品概要テーブルの「年齢指定」行から取り、表示を `全年齢` / `R15` / `R18` に正規化する（`R-15` → `R15`、`18禁` → `R18`）。取れないときは `null` で、パース失敗にはしない。

セレクタとフィクスチャテストは `dlsite.ts` を正典とする。DLsite側のHTML構造変更で `parse_error` が増えたら、セレクタとテストを同時に更新する。

## タグの変換規則

`dlsiteInfoTags`（`shared/src/dlsite.ts`）が取得情報を既存タグへ統合する際、prefixを付けて変換する。変換元は `DLSITE_TAG_FIELDS` という1つのテーブルにまとめてあり、各フィールドの cardinality（single/multi）もここで定義する。

- サークル名 → `サークル/<サークル名>`（single。DLsite側も1作品1値）
- CV → `cv/<CV名>`（multi）
- ジャンルタグ → `genre/<ジャンル名>`（multi）
- 年齢指定 → `rating/全年齢` または `rating/R15` または `rating/R18`（single。DLsite側も1作品1値）

変換後は `normalizeTags` で正規形にする。既存タグとの合流は `mergeAppliedDlsiteTags(existing, applyTags)` が担う。単体適用（replace）用で、ユーザーが `POST /dlsite/:id/apply` で明示的に選んだタグを反映する際に使う。single prefixは既存の同prefixタグを置き換え（2値共存を作らない）、multi prefixは加算する。prefix名で分岐する判定はマージ関数側に書かず、`DLSITE_TAG_FIELDS` の cardinality から導出する。

既存作品へ後からratingタグを足す場合は、単体適用でratingタグを選ぶ。prefix定義 `rating`（ラベル: レーティング）は初回起動のseedに含まれる。すでにseed済みのライブラリには自動追加しないので、軸表示が必要ならタグ設定の候補から登録する。

## 適用の流れ

作品への反映経路は2つある。取得ジョブは反映せず、取得結果とカバーをキャッシュへ記録するだけ（後述）。

**作品詳細の取得→差分確認→適用**: `POST /dlsite/:id/fetch` で作品の正本にあるRJコードを取得し、応答の `info`・`cachedCover`・`infoRevision`（解析結果の取得時刻とパーサー版の組。クライアントは解釈せず、そのまま適用へ送り返す不透明な文字列）・`sourceRevision`（作品の版）から、クライアントが `computeDlsiteWorkDiff`（`shared/src/dlsite.ts`）で差分を作って確認ダイアログに出す。既定の選択（`defaultDlsiteApplySelection`）は未設定の項目だけで、既存の値を置き換えるタグ（サークル・rating）は外れ、置き換えられる既存タグが行に出る。ユーザーが選んだ項目は `POST /dlsite/:id/apply`（`{ sourceRevision, infoRevision, apply: { title, cover, url, tags } }`）で反映する。サーバーは `info` を受け取らず、正本のRJコードでキャッシュを読み直し、`planDlsiteApply`（同じ差分計算を使う）で書く内容を決める。タイトルを使う条件は候補の追加と同じ `dlsiteTitleToApply`。キャッシュが使えない（TTL切れ・失敗・解析失敗）、または `infoRevision` が取得時と違うときは409 `dlsite_refetch_required` で、再取得を促す。`sourceRevision` が違うときは409 `source_changed`。`apply.tags` のうちDLsiteのタグでないものは無視する。カバーは、カバーキャッシュにあって画像として読め、作品フォルダーをルート内に解決できるときだけ、保存の共通手順（`saveWithDlsiteCover`）で作品フォルダーへ反映する。反映しなかったときは、ほかの項目は反映して成功とし、応答の `coverSkipped`（`not_cached`・`unreadable`・`outside_root`。カバーを選んでいない・DLsiteにカバーが無いときは `null`）に理由を返す。クライアントは既存の通知に「カバーは適用できませんでした」を添える（[ADR-0036](adr/0036-dlsite-cover-skipped-reason-and-candidate-refresh.md)）。保存名は作品の配置から決まる。メタ保存に失敗したときは新しいカバーを消して旧カバーへ戻す。適用の処理はDLsiteへHTTPを出さない。

**追加（候補の追加・Filesの作品登録）**: 未登録の候補は `POST /scan/candidates/register`（候補のパスと反映項目のフラグ。1リクエストの上限は `SCAN_CANDIDATE_REGISTER_MAX_PATHS`、クライアントが分割して送る）、Filesは `POST /works`（rjCode・title・tags・applyCover・applyUrl）で追加する。どちらもクライアントからDLsiteの取得結果は受け取らず、サーバーがRJコード（候補は候補一覧の値、Filesは入力）でキャッシュを引く。使うのはTTL内でoutcomeが `ok` のsnapshotを解析できたときだけで、TTL切れ・キャッシュに無い・該当なし・失敗・`parse_error`・RJコードなしはDLsite情報なしとしてフォルダー名・入力のまま追加する。組み立ては `planDlsiteRegistration`（`shared/src/dlsite.ts`）を2つのアダプタと2入口が共有し、`appliedTags` は「DLsiteのタグ」と「最終的なタグ」の共通部分になる。カバーはカバーキャッシュだけから、保存の共通手順（`saveWithDlsiteCover`）で作品フォルダーへ置く。置かなかったときは作品詳細の適用と同じく、追加を続けて `coverSkipped` に理由を返す（`POST /works` の応答と、`POST /scan/candidates/register` の `registered` の各要素）。追加の処理はDLsiteへHTTPを出さない。

**カバーの保存名**: 作品の配置（[ADR-0032](adr/0032-work-placement-from-meta-path.md)）から決まり、`dlsiteCoverBaseName`（`shared/src/workPlacement.ts`）が導く。フォルダー形式は `dlsite_cover.<ext>`、単一ファイル形式はメタ名の `.mimimilli.json` を置き換えた `<stem>.dlsite_cover.<ext>`。同じフォルダーの単一ファイル作品どうしで上書きし合わない（[ADR-0035](adr/0035-dlsite-cover-name-from-placement.md)）。同名の既存カバーは退避してから置き、メタ保存の成否で退避を消すか戻す。

**取得ジョブ**: スキャン・候補登録・作品登録・root再設定は取得を始めない。取得はユーザーが対象のproduct code（RJコード）を指定して `POST /dlsite/jobs` で始める。`DlsiteJobManager`（`server/src/dlsiteJobManager.ts`）がジョブを同時に1本だけ動かし、コードを1件ずつ `fetchDlsiteProduct`（real: `adapters/real/dlsiteMethods.ts`）で処理する。1件の処理は、作品ページの取得とキャッシュへの記録、カバーの先取り（ベストエフォート）、同じRJコードを持つ全作品の `work_dlsite.state_json` の再投影で、タイトル・タグ・カバー・`mimimilli.json` は変更しない。同期の単発取得（`POST /dlsite/:id/fetch`・`POST /dlsite/fetch-by-code`）も同じ処理を通る。

実行中に受けた取得は同じジョブのキューの末尾へ合流する。リクエストの `force` が true のコードは、キャッシュの失敗の記録を無視して取り直す。取得中のコードに force で取り直しを求めたときは、走行中の試行が終わりしだい取り直し、取得を終えたコードの再取得は force を引き継いで再キューする。取り直したコードも進捗の分母と中止の対象になる。中止は待機中のコードをすべて外し、取得中のコードは止めない。root再設定の開始時は、キューを捨てて取得中の処理を打ち切る。ジョブは永続化せず、サーバー再起動では再開しない。

未登録の候補一覧（`GET /scan/candidates`）の `dlsite` はキャッシュ由来の状態（`none` / `fetched` / `not_found` / `failed`）だけで、取得中は含めない。取得中の行はクライアントがジョブのsnapshotとSSEから出す。

**新旧の判定**: ジョブの状態には単調増加の `revision` が付く（プロセス全体で1つ。`max(前の値 + 1, 現在時刻のマイクロ秒)` で、クライアントに見える変化の直前に進める）。ジョブの終端は、候補と同じ導出関数（`deriveDlsiteProductSummary`）でキャッシュから導いた取得結果 `dlsite` を運ぶ。候補GETと `POST /scan/candidates/rj-code` の応答は、候補を組み立てる前に読んだ revision を各候補の `dlsiteRevision` に持つ。クライアントはサーバー状態を revision が進むものだけ取り込み、行の表示は候補の値と終端の結果のうち revision が大きい方（同じなら候補）を出す。ジョブの終端で候補を取り直さない。想定外の例外とオフラインで `failed` になった取得はキャッシュを書き換えないので、次の候補GETで表示がキャッシュの状態に戻る（[ADR-0038](adr/0038-dlsite-job-state-revision.md)）。

`work.dlsite.appliedTags` は、手動適用でこの作品へ反映したタグを `mimimilli.json` に記録したもの。

## 作品ごとの状態

`work.dlsite.status`（`shared/src/dlsite.ts` の `dlsiteStatusSchema`）は次の5値を取る。`mimimilli.json` に保存されるのは `none` / `applied` / `skipped` だけで、`not_found` と `error` はキャッシュの取得結果から投影した値（`projectDlsiteState`）。

| status      | 意味                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------- |
| `none`      | 初期状態。RJコード未検出の作品も、RJコードはあるが取得・適用をまだ試みていない作品もここに入る |
| `applied`   | 直近の適用が成功した                                                                           |
| `not_found` | 直近の取得でHTTP 404が返った                                                                   |
| `error`     | 直近の取得または適用が失敗した（`errorKind` で HTTP エラーと `parse_error` を区別）            |
| `skipped`   | ユーザーが明示的にこの作品を対象から外した                                                     |

適用に成功すると `applied` になる。取得が失敗しても `mimimilli.json` は変わらず、次の投影で `error` か `not_found` として見える。`skipped` は `PATCH /dlsite/:id` でユーザーが操作したときだけ遷移し、取得では変化しない。

この状態は「適用が必要か」だけを表す。HTTPを再取得するかどうかはこの状態では判断せず、常にキャッシュのTTLに委ねる。`applied` な作品でも、キャッシュが切れていれば手動の再取得で新しいHTTPが飛ぶ。

## キャッシュ

DLsiteの作品HTMLとカバー画像は、専用のSQLiteキャッシュ（`DlsiteCache`、`dlsiteCache.ts`）を経由してから実HTTPへ出る。既定のDBはデータルート配下の `db/dlsite-cache.sqlite`。`MIMIMILLI_DLSITE_CACHE_DB` に絶対パスを指定すると置き換えられる。

作品HTMLは生のHTMLをgzip圧縮してBLOBで保存する。生HTMLを持つのは、パーサーを直したときに実HTTPを再度飛ばさず既存HTMLで検証できるようにするため。あわせて、取得時の解析結果（`DlsiteWorkInfo`のJSON）を「解析結果」（`dlsite_parsed_products`）に、snapshotの記録と同じ書き込みで保存する。行にはsnapshotの `content_fetched_at` とパーサーの版（`DLSITE_PARSER_VERSION`、`dlsite.ts`）を持ち、候補一覧・取得のキャッシュヒットはこの行を読む（`dlsiteProductResolve.ts`）。行が無い、`content_fetched_at` が違う、版が違うときだけ生HTMLを展開して解析し、書き戻す。`parseDlsiteHtml` の出力を変えたときは版を上げる。解析失敗（`parse_error`）のsnapshotは版を上げても解析し直さず、TTL（1時間）が切れてから取り直す。

保存は「HTML snapshot」（`dlsite_html_snapshots`）と「取得失敗記録」（`dlsite_fetch_failures`）の2テーブルが基本で、取得時の解析結果が前述の `dlsite_parsed_products`。テーブルを分けているのは、取得が失敗しても直前に成功したHTMLを消さないため。カバー画像は正規化済みHTTPS URLのSHA-256をキーにした別テーブル（`dlsite_cover_entries`）に、非圧縮のBLOBで持つ。

キャッシュキーはストア（RJは `maniax`、VJは `pro`）、大文字化したproduct code、`work-html-ja-adultchecked-v1`（`DLSITE_CACHE_REPRESENTATION`）の組み合わせ。representationは取得条件（言語・adultchecked Cookie・対象ページ）のバージョンで、取得の前提を変えたらこの文字列を上げてキャッシュを無効化する。

outcome（HTML snapshot側）と既定TTL。

| outcome       | 意味                                       | TTL   |
| ------------- | ------------------------------------------ | ----- |
| `ok`          | HTMLをパースできた                         | 30日  |
| `parse_error` | HTMLは取得できたが現在のパーサーで読めない | 1時間 |

failure_kind（失敗記録側）と既定TTL。

| failure_kind | 意味                   | TTL   |
| ------------ | ---------------------- | ----- |
| `not_found`  | HTTP 404               | 3日   |
| `error`      | 一時的なHTTP・通信障害 | 1時間 |

TTLは `DEFAULT_DLSITE_CACHE_TTLS_MS`（`shared/src/dlsite.ts`）の定数で固定されている。通常取得の判断順序は、有効な失敗記録があればそれを返し（ネットワークへ出ない）、なければ有効なHTML snapshotを（保存済みの解析結果を使って）返し、どちらもなければネットワークへ出る。force（`?force=true`、取得ジョブの `force: true`）は、有効な失敗記録と解析できないsnapshot（`parse_error`、またはokでも今のパーサーで解析できないもの）をmissとして扱い、ネットワークへ取り直す。TTL内で解析できるokのsnapshotはforceでもそのまま使い、ネットワークへ出ない。書き込みは通常時と同じ規則に従う。

HTMLの転送・展開サイズには上限があり（既定2 MiB / 8 MiB、`DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES` / `DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES`）、gzip展開時にも `zlib` の `maxOutputLength` で同じ上限を渡してgzip bombを防ぐ。転送サイズの上限はHTTP応答にだけ課す。CLIのローカルファイルimportは転送を伴わないため、展開後サイズの上限だけで判定する。

取得が失敗した作品は、HTTPレスポンスまたはパース結果を DLsite キャッシュへ記録する。`mimimilli.json`は変更しない。キャッシュ更新後、scan・取得ジョブ・手動fetch はいずれも、`mimimilli.json`の正本とキャッシュを合成して `work_dlsite.state_json` を再投影する（`dlsiteProjection.ts`）。これにより作品詳細の取得失敗・パース失敗の警告が、フルスキャンを待たずに反映される。`offline` 由来の miss はキャッシュにも catalog にも書かない。

キャッシュ hit（HTTPを試みなかった）で、投影済みの `status`・`error`・`errorKind` がキャッシュ内容とすでに一致しているときは、catalog への再投影を省略してよい（実装は経路ごとに投影関数を呼ぶ。副作用は同一状態の upsert にとどまる）。`lastAttemptAt` は実HTTPを試みたときだけキャッシュに記録され、投影時に catalog へ載る。cache hit では更新しない。

## レート制限とリトライ

作品HTML、カバー画像、カバーのリダイレクト先はすべて単一の `DlsiteScheduler`（`dlsiteScheduler.ts`）を経由する。実HTTPの開始時刻は `MIMIMILLI_DLSITE_REQUEST_INTERVAL_MS`（既定1000ms）以上離す。直列キューで管理しているため、複数リクエストが同時に飛ぶことはない。

429、5xx、通信エラーは指数バックオフとjitterで再試行する。再試行回数は3、最大backoffは30000ms、リクエスト全体の期限は60000ms（いずれも `DEFAULT_DLSITE_REQUEST_CONFIG`、`dlsiteConfig.ts`）。429と503の `Retry-After`ヘッダー（秒指定・HTTP-date指定の両方に対応）は共有cooldownとして後続のすべてのリクエストに適用する。404とパース失敗は一時的な障害ではないため再試行しない。

## オフラインフラグ

`MIMIMILLI_DLSITE_OFFLINE=true` は、作品HTML・カバー画像・カバーのリダイレクト先を含むDLsiteへの実HTTPをすべて止める。ネットワーク環境がない場所での動作確認や、意図せず実サイトへアクセスしたくないデバッグ用途のフラグ。

有効時、キャッシュのhit（forceでも、TTL内で解析できるokのsnapshot）は通常どおり使える。miss、および失敗の記録を取り直すforceは明示的な `offline` エラー（`DlsiteOfflineError`）になり、キャッシュにも `work.dlsite.status` にも書き込まない。オフラインで試しただけの結果を本物の取得失敗として残さないための挙動。値は `true` または `false` のみで、未指定時は `false`。

## 安全性

- カバー画像URLは `img.dlsite.jp` / `img.dlsite.com` のみ許可し、HTTPS以外・ユーザー情報付き・非標準ポートのURLは拒否する（`normalizeDlsiteCoverUrl`）。クライアント由来のURLをそのまま使わずここで検証することで、任意ホストへのリクエスト（SSRF）を防ぐ
- カバー画像のリダイレクトは最大5回まで追い、追うたびに同じホスト制限を再検証する
- 作品HTML・カバー画像とも、レスポンスの`content-length`と実際の受信量の両方にサイズ上限を課す
- 作品HTMLは `Content-Type: text/html` 以外を、カバー画像は `image/jpeg|png|webp|gif` 以外を拒否する

## 設定

環境変数と既定値の一覧。

| 環境変数                               | 既定値                                    | 内容                     |
| -------------------------------------- | ----------------------------------------- | ------------------------ |
| `MIMIMILLI_DLSITE_CACHE_DB`            | データルート配下 `db/dlsite-cache.sqlite` | キャッシュDBの絶対パス   |
| `MIMIMILLI_DLSITE_OFFLINE`             | `false`                                   | 実HTTPをすべて止める     |
| `MIMIMILLI_DLSITE_REQUEST_INTERVAL_MS` | 1000ms                                    | 実HTTP開始時刻の最小間隔 |

値は厳格に検証する（真偽値は `true`/`false` のみ、数値は0以上の整数のみ）。曖昧な指定はフォールバックせずエラーにする。

## 運用手順

`pnpm --filter @mimimilli/server dlsite-cache` CLI（`server/src/dlsiteCacheCli.ts`）でキャッシュを操作する。

状態確認。

```sh
pnpm --filter @mimimilli/server dlsite-cache -- status
```

期限切れの行（対応するsnapshotが無い解析結果の行を含む）だけを削除する。容量上限や自動削除は現状ないため、定期的に実行する。

```sh
pnpm --filter @mimimilli/server dlsite-cache -- cleanup
```

手元にあるHTMLを実HTTPなしで取り込む（単体ファイル）。

```sh
pnpm --filter @mimimilli/server dlsite-cache -- import --product-code RJ000000 --file /absolute/path/work.html
```

キャッシュ済みHTMLを取り出す（パース失敗の原因調査用。単体exportは非圧縮で書き出す）。

```sh
pnpm --filter @mimimilli/server dlsite-cache -- export --product-code RJ000000 --file /absolute/path/work.html
```

ディレクトリ一括import（非再帰。サブディレクトリは対象外）。

```sh
pnpm --filter @mimimilli/server dlsite-cache -- import --dir /absolute/path/to/bulk-html
```

対象の絞り込みは二段階になっている。拡張子が `.html` / `.html.gz` 以外のファイルはディレクトリ列挙の時点で無視され、成功・失敗どちらの件数にも出てこない。拡張子は合っていてもファイル名が `<RJまたはVJコード>.html[.gz]` の命名規約に合わない場合（例: `readme.html`）は一覧に残り、失敗として記録・返却される。

gzip入力かどうかは拡張子ではなくheaderのmagic byte（`0x1f 0x8b`）で判定し、該当すれば自動で展開して取り込む（`.html` 拡張子のgzipファイルも展開できる）。importはsymlinkと上限超過を拒否し、実HTTPで新たに試料を取得することはしない。サイズ判定は展開後サイズの上限（8 MiB）だけで行う。転送サイズの上限はHTTP応答にのみ課すもので、ローカルファイルには適用しない。importはHTML snapshotだけを更新し（成功記録と同じ扱い）、失敗記録には触れない。ディレクトリimportは1件の失敗で全体を止めず、成功・失敗の件数と失敗したファイル名・理由をJSONで返す。

### バックアップと復元

キャッシュ済みのHTML snapshotをディレクトリへ書き出して長期保管する。

```sh
pnpm --filter @mimimilli/server dlsite-cache -- export --dir /absolute/path/to/archive
```

出力先は存在しないディレクトリか空のディレクトリのみ許可し、非空ならエラーで中断する。上書きを許すと、前回のexport後にDBから消えたproduct codeのファイルが残り、復元時に消したはずのsnapshotが復活してしまうため。

書き出すのは現行representationのHTML snapshotだけで、TTL切れの行も対象になる（cleanupで消える前なら書き出せる）。DBはgzip圧縮したBLOBを持っているので、展開せずそのまま `<PRODUCTCODE>.html.gz` として書く。結果はディレクトリimportと同じJSON（成功件数・失敗件数・失敗したファイル名と理由）で、1件の失敗で全体を止めない。

復元はそのまま `import --dir` に渡す。

```sh
pnpm --filter @mimimilli/server dlsite-cache -- import --dir /absolute/path/to/archive
```

importはHTML snapshotを成功記録として書き直すため、取り込んだ時点からTTLが振り直される。DBファイルのバックアップと違い、生HTMLのアーカイブはキャッシュDBのスキーマ変更を跨いで使える。

復元できるのはHTML snapshotだけで、次のものは対象外。復元後も実HTTPが発生しうる。

- 取得失敗記録（`dlsite_fetch_failures`）。404・通信失敗はTTLが3日・1時間と短く、アーカイブしてもすぐ期限切れになる
- カバー画像（`dlsite_cover_entries`）。ローカルにカバーがない作品は、HTMLがcache hitしてもカバー取得へ進む。適用済み作品のカバーは作品フォルダーへ保存されるため通常は再取得されない

失敗の記録を無視して取り直したい場合は、`POST /dlsite/:id/fetch?force=true` や `POST /dlsite/fetch-by-code?force=true` を使う（TTL内で解析できるokのsnapshotは使うので、オフライン設定でも成功する）。作品詳細の「取得」とFilesの「取得」は、ユーザーが1件の結果を待って押す取り直しなので、クライアントは常にforce付きで呼ぶ（失敗の記録を無視して取り直す）。キャッシュの行自体を消したい場合は、TTLが切れるのを待って `cleanup` する。

## 取得失敗・パース失敗の検知

`errorKind` は取得ジョブ・同期取得（`POST /dlsite/:id/fetch`・`POST /dlsite/fetch-by-code`）で失敗を記録したときに更新される。取得のあとは、同じRJコードを持つ全作品の投影が更新される。作品詳細の警告（`WorkStatusWarnings`）は、`shared/src/dlsite.ts` の述語で作品の `work.dlsite` を判定して出す。

- `isRjCodeMissing`: `rjCode === null` かつ `status !== skipped`
- `isDlsiteFetchFailed`: `status` が `not_found`、または `error` かつ `errorKind !== parse_error`
- `isDlsiteParseFailed`: `status === error` かつ `errorKind === parse_error`

実HTTPで `parse_error` が確定したとき、サーバーは構造化ログ `dlsite_parse_error`（`productCode`・`httpAttempted`）を出力する。

## HTTPエンドポイント

`server/src/routes/dlsite.ts` に実装がある。進捗SSEの契約は [ADR-0030](adr/0030-job-progress-sse-current-state.md)。

- `POST /dlsite/:id/fetch` — 1作品分の取得プレビュー（`info`・`infoRevision`・`cachedCover`・`sourceRevision`）。`?force=true` で失敗の記録を無視して取り直す
- `POST /dlsite/fetch-by-code` — 未登録のRJ/VJコードの取得（Filesの登録ダイアログ）。body は `{ rjCode }`、応答は `info` と `cachedCover`。`?force=true` で失敗の記録を無視して取り直す
- `GET /media/dlsite-cover/:key` — DLsiteカバーキャッシュの配信。クライアントは応答の `cachedCover`（`key`・`version`）からURLを作る
- `POST /dlsite/:id/apply` — 取得したDLsite情報のうち選択した項目を、キャッシュから読んで適用。`dlsite_refetch_required`（409）は再取得を促す
- `PATCH /dlsite/:id` — RJコードの手動設定（空文字は「コードなし」の明示、`null` は受け付けない）、または `skipped` の切り替え
- `POST /dlsite/jobs` — 取得ジョブを開始し、202 `{ revision, job }`（受け付けた直後の状態。`GET /dlsite/jobs/current` と同じ形）を返す。実行中ジョブがあればそのキューへ合流する。body は `{ productCodes, force? }`（1〜1000件。`force` が true のとき失敗の記録を無視して取り直す。既定は false）。オフライン設定では `offline`、サーバーの終了処理中は409（`conflict`）で拒否する
- `GET /dlsite/jobs/current` — 常に200で `{ revision, job }`。`revision` はプロセス全体で単調に増える状態の新旧の値。`job` は `jobId`・`status`（`running` / `finished`）・コードごとの `state`（`queued` / `fetching` / `fetched` / `not_found` / `failed`）・`revision`（そのコードが最後に変化した時点の値）・進捗 `progress`。終端のコードは取得結果 `dlsite`（`fetched` はタイトルとカバー）も持つ。終了したジョブは次のジョブ開始まで残る。無ければ `job: null`
- `DELETE /dlsite/jobs/:jobId` — 待機中のコードをキューから外し `{ removed }` を返す。IDが現在のジョブと違う・対象なしは `removed: 0`
- `GET /dlsite/jobs/events` — 取得ジョブの進捗SSE。接続直後に `snapshot`（`revision` と現在のジョブ、無ければ `job: null`）を送り、実行中なら以後 `code`（コードの現在状態。終端なら `dlsite` を含む）・`removed`（中止で外れたコード）・`finished`（`complete` / `aborted`）をlive配信して `finished` で閉じる。すべてのイベントが `revision` を持つ。15秒間隔で `ping` を送る
