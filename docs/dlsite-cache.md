# DLsiteキャッシュとリクエスト制御

DLsiteの作品ページとカバー画像は、実HTTPへ出る前にローカルキャッシュを確認します。既定のDBはデータルートの `db/dlsite-cache.sqlite` です。`MIMIKAGO_DLSITE_CACHE_DB` に絶対パスを指定すると置き換えられます。

## 保存内容

作品HTMLのキーは `resource_kind=work_html`、ストア（RJ は `maniax`、VJ は `pro`）、大文字化したproduct code、`work-html-ja-adultchecked-v1` です。HTML本文はgzip BLOBで保存します。カバー画像は正規化済みHTTPS URLのSHA-256をキーにして、非圧縮のBLOBで保存します。

作品HTMLのoutcomeと既定TTLは次のとおりです。

| outcome       | 意味                                     | TTL   |
| ------------- | ---------------------------------------- | ----- |
| `ok`          | HTMLをパースできた                       | 30日  |
| `parse_error` | HTMLは取得したが現在のパーサーで読めない | 1時間 |
| `not_found`   | HTTP 404                                 | 3日   |
| `error`       | 一時的なHTTP・通信障害                   | 1時間 |

`MIMIKAGO_DLSITE_CACHE_TTL_OK_MS`、`MIMIKAGO_DLSITE_CACHE_TTL_PARSE_ERROR_MS`、`MIMIKAGO_DLSITE_CACHE_TTL_NOT_FOUND_MS`、`MIMIKAGO_DLSITE_CACHE_TTL_ERROR_MS` でTTLをミリ秒指定できます。HTMLの転送・展開上限は各2 MiB・8 MiBで、`MIMIKAGO_DLSITE_CACHE_MAX_TRANSFER_BYTES` と `MIMIKAGO_DLSITE_CACHE_MAX_EXPANDED_BYTES` で変えられます。値はすべて正の整数として厳格に検証します。

期限切れの行だけを消すには `pnpm --filter @mimimilli/server dlsite-cache -- cleanup` を使います。容量と行数は `pnpm --filter @mimimilli/server dlsite-cache -- status` で確認します。容量の上限や自動削除は現在設けていないため、定期的にcleanupを実行してください。

既に手元にあるHTMLだけを取り込む場合は、ネットワークに出ず次を実行します。

```sh
pnpm --filter @mimimilli/server dlsite-cache -- import --product-code RJ123456 --file /absolute/path/work.html
```

importは通常ファイルの `.html` だけを受け付け、symlink・gzip入力・上限超過を拒否します。実HTTPを新たに取得して試料を作ることはしません。

## forceとoffline

手動fetchの `?force=true` はfresh cacheを無視して再取得します。更新失敗時は既存の成功HTMLを即座に削除せず、期限切れとして扱います。

`MIMIKAGO_DLSITE_OFFLINE=true` にすると、作品HTML、カバー画像、リダイレクト先を含むDLsiteの実HTTPをすべて止めます。cache hitは通常どおり使えます。cache missとforceは `offline` エラーになり、キャッシュにも書き込みません。一括取得ではoffline由来の失敗を `work_dlsite.status=error` に保存しません。値は `true` または `false` だけです。未指定時は `false` です。

## レート制限と再試行

HTML、カバー、カバーの各リダイレクトは単一schedulerを通ります。実HTTPの開始時刻は `MIMIKAGO_DLSITE_REQUEST_INTERVAL_MS`（既定1000ms）以上離します。最初の1件は待機しません。

429、5xx、通信エラーは指数バックオフとjitterで再試行します。再試行回数、最大backoff、1リクエスト全体の期限はそれぞれ `MIMIKAGO_DLSITE_RETRY_COUNT`（既定3）、`MIMIKAGO_DLSITE_MAX_BACKOFF_MS`（既定30000）、`MIMIKAGO_DLSITE_TIMEOUT_MS`（既定60000）で設定します。すべて0以上の整数（timeoutは1以上）です。429と503の `Retry-After`（秒またはHTTP-date）は共有cooldownとして後続リクエストにも適用します。404とパース失敗は再試行しません。

ログには `dlsite_cache_hit`、`dlsite_cache_miss`、`dlsite_http_request`、`dlsite_http_retry` を出し、hit/missと実HTTP数を確認できます。

## 実ページ試料

実ページの試料はリポジトリにありません。新規HTTPは実行していないため、実サイズとgzip圧縮率の測定は未完です。ユーザー提供または既存取得済みの試料が得られた場合だけ、測定結果をここへ追記します。
