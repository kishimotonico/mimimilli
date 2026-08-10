# DLsite連携

DLsiteの作品ページから情報を取得し、作品のタイトル・タグ・カバー画像・URLへ反映する機能。要件は[requirements-v4.md](requirements-v4.md) 4.4節。実装は主に `server/src/adapters/real/dlsite.ts`、`dlsiteCache.ts`、`dlsiteScheduler.ts`、`index.ts` にある。API契約の正典はこのドキュメントではなく `shared/src/dlsite.ts`（Zodスキーマ）。

## RJ/VJコードの検出

`detectRjCode`（`dlsite.ts`）が、フォルダー名・タイトルの順で候補文字列を調べ、`RJ\d{6,8}`（大文字小文字を無視）にマッチした最初のコードを採用する。作品に紐づくRJコードが未検出のときだけ、この自動検出を試みる。

自動検出の対象はRJコードのみで、VJコードは自動検出しない。VJ作品は `PATCH /dlsite/:id` でユーザーが手動でコードを設定する。

作品ページのURLはコードのprefixでストアが分かれる。RJ（同人）は `maniax`、VJ（商業・美少女ゲーム）は `pro` で、ストアを誤ると常に404（`not_found`）になる。手動設定でVJコードが入った作品も、以降はこのprefix判定に従って `pro` のURLで取得する。

```
https://www.dlsite.com/maniax/work/=/product_id/RJ000000.html
https://www.dlsite.com/pro/work/=/product_id/VJ000000.html
```

## 取得する情報

`parseDlsiteHtml` が作品ページのHTMLから抽出するのは、タイトル、サークル名、CV（声優）一覧、ジャンルタグ一覧、カバー画像URL、作品URLの6つ（`DlsiteWorkInfo`、`shared/src/dlsite.ts`）。タイトルが取得できない場合は `parse_error` として扱う。ジャンルタグはリンク先が `/fs/=/genre/` または `/fsr/=/genre/` のものだけを対象にし、特集・キャンペーンへの通常リンクを除外する。

セレクタとフィクスチャテストは `dlsite.ts` を正典とする。DLsite側のHTML構造変更で `parse_error` が増えたら、セレクタとテストを同時に更新する。

## タグの変換規則

`mergeDlsiteTags` が取得情報を既存タグへ統合する際、prefixを付けて変換する。

- サークル名 → `サークル/<サークル名>`
- CV → `cv/<CV名>`
- ジャンルタグ → `genre/<ジャンル名>`

変換後は `normalizeTags` で正規形にし、正規化後に重複するタグは追加しない。

## 適用の流れ

適用経路は2つある。

**手動プレビュー→適用**: `POST /dlsite/:id/fetch` で取得結果をプレビューし、ユーザーが選んだ項目だけを `POST /dlsite/:id/apply`（`DlsiteApplyBody`）で反映する。タイトル・タグ・カバーそれぞれに適用可否のフラグがあり、ユーザーが個別に選べる。

**一括取得**: `POST /dlsite/bulk` が `runDlsiteBulk`（`index.ts`）を呼び、対象作品をまとめて処理する。`mode` には `new` と `existing` があり、スキャン直後の自動起動（`scanJobManager.ts`）は新規作品だけを対象に `new` で呼ぶ。手動の「まとめて取得」ボタンは `existing` で呼ぶ。

両モードの違いは、取得したジャンル・サークル・CVタグをどこまで適用するか。`new` は取得した全タグをそのまま追加する。`existing` は `work.dlsite.appliedTags`（前回までにこの作品へ適用したタグ）と比較した差分だけを追加する。再取得のたびに同じタグが積み上がるのを防ぐための仕組みで、適用したタグは `appliedTags` として作品ごとに記録し続ける。

タイトルの上書きは `isDefaultTitle`（`server/src/core/dlsiteTitle.ts`）で保護する。現在のタイトルがフォルダー名またはRJコードそのものと一致する場合だけ「ユーザー未編集」とみなし、`existing` でもDLsiteのタイトルで上書きする。それ以外はユーザーが手動編集したとみなし上書きしない。`new` は新規作品なので常に上書きする。

## 作品ごとの状態

`work.dlsite.status`（`shared/src/dlsite.ts` の `dlsiteStatusSchema`）は次の5値を取る。

| status      | 意味                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------- |
| `none`      | 初期状態。RJコード未検出の作品も、RJコードはあるが取得・適用をまだ試みていない作品もここに入る |
| `applied`   | 直近の適用が成功した                                                                           |
| `not_found` | 直近の取得でHTTP 404が返った                                                                   |
| `error`     | 直近の取得または適用が失敗した（`errorKind` で HTTP エラーと `parse_error` を区別）            |
| `skipped`   | ユーザーが明示的にこの作品を対象から外した                                                     |

`none`・`error`・`not_found` の作品は一括取得の対象になり、`applied` と `skipped` は対象から外れる（`runDlsiteBulk` 冒頭のフィルタ）。適用に成功すると `applied` に、失敗すると `error` か `not_found` に遷移する。`skipped` は `PATCH /dlsite/:id` でユーザーが操作したときだけ遷移し、一括取得では変化しない。

なお `shared/src/dlsite.ts` の `isDlsiteUnlinked()` は `rjCode !== null && status === "none"` で「RJコードはあるが未連携」を判定する。これは通知バッジ用の別の基準で、`none` そのものの定義とは区別する。

この状態は「適用が必要か」だけを表す。HTTPを再取得するかどうかはこの状態では判断せず、常にキャッシュのTTLに委ねる。`applied` な作品でも、キャッシュが切れていれば手動の再取得で新しいHTTPが飛ぶ。

## キャッシュ

DLsiteの作品HTMLとカバー画像は、専用のSQLiteキャッシュ（`DlsiteCache`、`dlsiteCache.ts`）を経由してから実HTTPへ出る。既定のDBはデータルート配下の `db/dlsite-cache.sqlite`。`MIMIMILLI_DLSITE_CACHE_DB` に絶対パスを指定すると置き換えられる。

作品HTMLは生のHTMLをgzip圧縮してBLOBで保存する。パース結果ではなく生HTMLを持つのは、パーサーを直したときに実HTTPを再度飛ばさず既存HTMLで検証できるようにするため。

保存は「HTML snapshot」（`dlsite_html_snapshots`）と「取得失敗記録」（`dlsite_fetch_failures`）の2テーブルに分かれている。テーブルを分けているのは、取得が失敗しても直前に成功したHTMLを消さないため。カバー画像は正規化済みHTTPS URLのSHA-256をキーにした別テーブル（`dlsite_cover_entries`）に、非圧縮のBLOBで持つ。

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

TTLは `DEFAULT_DLSITE_CACHE_TTLS_MS`（`dlsiteCache.ts`）の定数で固定されている。通常取得の判断順序は、有効な失敗記録があればそれを返し（ネットワークへ出ない）、なければ有効なHTML snapshotをパースして返し、どちらもなければネットワークへ出る。`?force=true` はキャッシュの読み取りだけを無視して必ずネットワークへ出るが、書き込みは通常時と同じ規則に従う。

HTMLの転送・展開サイズには上限があり（既定2 MiB / 8 MiB、`DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES` / `DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES`）、gzip展開時にも `zlib` の `maxOutputLength` で同じ上限を渡してgzip bombを防ぐ。

一括取得の対象は `applied` と `skipped` を除く（上記「作品ごとの状態」参照）。`applied` の作品は2回目以降の一括取得では対象外になるため、成功時の「変更なしなら書き込まない」判定は存在しない。

取得が失敗した作品について、キャッシュ hit（HTTPを試みなかった）かつ、作品の `status`・`error`・`errorKind` が、今回の失敗結果とすでに一致しているときは、DBと `mimimilli.json` への書き込みを省略する。実HTTPを試みた場合は常に書き込む。`lastAttemptAt` は実際にHTTPを試みたときだけ更新し、cache hitでは更新しない。

## レート制限とリトライ

作品HTML、カバー画像、カバーのリダイレクト先はすべて単一の `DlsiteScheduler`（`dlsiteScheduler.ts`）を経由する。実HTTPの開始時刻は `MIMIMILLI_DLSITE_REQUEST_INTERVAL_MS`（既定1000ms）以上離す。直列キューで管理しているため、複数リクエストが同時に飛ぶことはない。

429、5xx、通信エラーは指数バックオフとjitterで再試行する。再試行回数は3、最大backoffは30000ms、リクエスト全体の期限は60000ms（いずれも `DEFAULT_DLSITE_REQUEST_CONFIG`、`dlsiteConfig.ts`）。429と503の `Retry-After`ヘッダー（秒指定・HTTP-date指定の両方に対応）は共有cooldownとして後続のすべてのリクエストに適用する。404とパース失敗は一時的な障害ではないため再試行しない。

## オフラインフラグ

`MIMIMILLI_DLSITE_OFFLINE=true` は、作品HTML・カバー画像・カバーのリダイレクト先を含むDLsiteへの実HTTPをすべて止める。ネットワーク環境がない場所での動作確認や、意図せず実サイトへアクセスしたくないデバッグ用途のフラグ。

有効時、キャッシュのhitは通常どおり使える。missとforceは明示的な `offline` エラー（`DlsiteOfflineError`）になり、キャッシュにも `work.dlsite.status` にも書き込まない。オフラインで試しただけの結果を本物の取得失敗として残さないための挙動。値は `true` または `false` のみで、未指定時は `false`。

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

期限切れの行だけを削除する。容量上限や自動削除は現状ないため、定期的に実行する。

```sh
pnpm --filter @mimimilli/server dlsite-cache -- cleanup
```

手元にあるHTMLを実HTTPなしで取り込む（単体ファイル）。

```sh
pnpm --filter @mimimilli/server dlsite-cache -- import --product-code RJ000000 --file /absolute/path/work.html
```

キャッシュ済みHTMLを取り出す（パース失敗の原因調査用）。

```sh
pnpm --filter @mimimilli/server dlsite-cache -- export --product-code RJ000000 --file /absolute/path/work.html
```

ディレクトリ一括import（非再帰。サブディレクトリは対象外）。

```sh
pnpm --filter @mimimilli/server dlsite-cache -- import --dir /absolute/path/to/bulk-html
```

対象の絞り込みは二段階になっている。拡張子が `.html` / `.html.gz` 以外のファイルはディレクトリ列挙の時点で無視され、成功・失敗どちらの件数にも出てこない。拡張子は合っていてもファイル名が `<RJまたはVJコード>.html[.gz]` の命名規約に合わない場合（例: `readme.html`）は一覧に残り、失敗として記録・返却される。

gzip入力かどうかは拡張子ではなくheaderのmagic byte（`0x1f 0x8b`）で判定し、該当すれば自動で展開して取り込む（`.html` 拡張子のgzipファイルも展開できる）。importはsymlinkと上限超過を拒否し、実HTTPで新たに試料を取得することはしない。importはHTML snapshotだけを更新し（成功記録と同じ扱い）、失敗記録には触れない。ディレクトリimportは1件の失敗で全体を止めず、成功・失敗の件数と失敗したファイル名・理由をJSONで返す。

強制的に再取得したい場合は、`POST /dlsite/:id/fetch?force=true` でキャッシュの読み取りだけを無視する。クライアント（`client/src/entities/work/api.ts`）はforceを付けずに呼ぶため、UIからは到達できない。現状は手で叩くときだけの手段。キャッシュの行自体を消したい場合は、TTLが切れるのを待って `cleanup` する。

## 通知とパース失敗の検知

通知ベル（`GET /dlsite/notifications`）は作品カタログの `work.dlsite` を集計する。`errorKind` は一括取得で失敗を記録したときだけ更新され、手動プレビュー（`POST /dlsite/:id/fetch`）では変わらない。

サマリーの主なフィールド。

| フィールド         | 意味                                                                     |
| ------------------ | ------------------------------------------------------------------------ |
| `fetchFailedCount` | `status` が `not_found`、または `error` かつ `errorKind !== parse_error` |
| `parseErrorCount`  | `status === error` かつ `errorKind === parse_error`                      |
| `parseErrorAlert`  | パース失敗が構造変更レベルで増えたとみなす警告（下記しきい値）           |

`parseErrorAlert` の判定（`evaluateParseErrorAlert`、定数は `shared/src/dlsite.ts`）。

- `parseErrorCount >= 3`
- かつ `parseErrorCount / (parseErrorCount + parseSuccessCount) >= 0.2`
- 分母の `parseSuccessCount` は `status === applied`（パース成功して適用済みの作品数）
- `not_found`・HTTPエラー（`error` かつ `errorKind !== parse_error`）はパース未到達のため分母に含めない

通知ベルのバッジは `parseErrorAlert` が true のときだけ `parseErrorCount` を加算する。パース失敗一覧は `GET /dlsite/notifications/parse-failed`（各行に `rjCode` 付き）。取得失敗一覧（`fetch-failed`）からは `parse_error` を除外する。

一括取得の完了結果（SSE `complete` / `cancelled`）には `parseErrors`（そのジョブで `parse_error` になった作品数）が含まれる。

実HTTPで `parse_error` が確定したとき、サーバーは構造化ログ `dlsite_parse_error`（`productCode`・`httpAttempted`）を出力する。

## HTTPエンドポイント

`server/src/routes/dlsite.ts` と `dlsiteProgress.ts` に実装がある。

- `GET /dlsite/notifications` — RJコード未検出・取得失敗・パース失敗の件数サマリー（`parseErrorAlert` 含む）
- `GET /dlsite/notifications/:kind` — `rj-missing` / `fetch-failed` / `parse-failed` の該当作品一覧（ページング。`parse-failed` のみ `rjCode` 付き）
- `POST /dlsite/:id/fetch` — 1作品分の取得プレビュー。`?force=true` でキャッシュを無視
- `POST /dlsite/:id/apply` — プレビュー結果のうち選択した項目を適用
- `PATCH /dlsite/:id` — RJコードの手動設定、または `skipped` の切り替え
- `POST /dlsite/bulk` — 一括取得ジョブを開始（`mode: "existing"`で起動。実行中は409相当のエラー）
- `GET /dlsite/events` — 一括取得の進捗をSSEで配信。ジョブ実行中に接続すると直近の進捗を再送し、実行中でなければ直近の完了/エラーを1件返す

一括取得ジョブは `dlsiteProgress.ts` のFIFOキューで直列実行するが、投入経路によって挙動が非対称になっている。スキャン完了後の自動起動（`scanJobManager.ts`、`mode: "new"`）は `enqueueDlsiteJob` を直接呼ぶため、実行中のジョブがあってもキューに積まれ、順番に処理される。一方、手動の `POST /dlsite/bulk` は先に `isDlsiteJobInProgress()` を確認し、実行中ならキューに積まれずconflictエラーで即座に弾かれる。
