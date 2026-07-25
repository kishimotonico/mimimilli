# DLsiteキャッシュとリクエスト制御

DLsiteの作品ページとカバー画像は、実HTTPへ出る前にローカルキャッシュを確認します。既定のDBはデータルートの `db/dlsite-cache.sqlite` です。`MIMIKAGO_DLSITE_CACHE_DB` に絶対パスを指定すると置き換えられます。

## 保存内容

作品HTMLは「HTML snapshot」と「取得失敗記録」を別テーブルで持ちます。両者は独立して更新されるため、取得が失敗しても直前に成功したHTMLが消えることはありません。

- `dlsite_html_snapshots`: HTTPが2xxで完了したときの記録（パースの成否は問わない）。gzip BLOBの本文、`content_type`、転送サイズを持つ
- `dlsite_fetch_failures`: HTTPが失敗した（404・5xx・通信エラー）ときの記録。本文は持たず、いつまで再試行を抑制するかだけを持つ

キーは `resource_kind=work_html`、ストア（RJ は `maniax`、VJ は `pro`）、大文字化したproduct code、`work-html-ja-adultchecked-v1` です。カバー画像は正規化済みHTTPS URLのSHA-256をキーにして、非圧縮のBLOBで別テーブル（`dlsite_cover_entries`）に保存します。

通常取得は次の優先順位で判断します。ネットワークへ出るかどうかは常にこのキャッシュ状態が決めます。

1. 有効な失敗記録があれば、ネットワークへ出ずその失敗を返す
2. 失敗記録がなく、有効なHTML snapshotがあれば、それをパースして返す
3. どちらもなければネットワークへ出る

書き込みは次のとおりです。

- HTTPが2xxで完了した（パースの成否を問わない）: HTML snapshotを更新し、失敗記録があれば削除する
- HTTPが失敗した: 失敗記録だけを更新する。既存のHTML snapshotは診断用に残したまま、通常取得には使わない
- `?force=true` はキャッシュの読み取りだけを無視して必ずネットワークへ出る。書き込みは通常時と同じ規則に従うため、forceが失敗しても失敗記録は残り、次の通常取得はその失敗記録に従って抑制される

HTML snapshotのoutcomeと既定TTLは次のとおりです。

| outcome       | 意味                                     | TTL   |
| ------------- | ---------------------------------------- | ----- |
| `ok`          | HTMLをパースできた                       | 30日  |
| `parse_error` | HTMLは取得したが現在のパーサーで読めない | 1時間 |

失敗記録のfailure_kindと既定TTLは次のとおりです。

| failure_kind | 意味                   | TTL   |
| ------------ | ---------------------- | ----- |
| `not_found`  | HTTP 404               | 3日   |
| `error`      | 一時的なHTTP・通信障害 | 1時間 |

`MIMIKAGO_DLSITE_CACHE_TTL_OK_MS`、`MIMIKAGO_DLSITE_CACHE_TTL_PARSE_ERROR_MS`、`MIMIKAGO_DLSITE_CACHE_TTL_NOT_FOUND_MS`、`MIMIKAGO_DLSITE_CACHE_TTL_ERROR_MS` でTTLをミリ秒指定できます。HTMLの転送・展開上限は各2 MiB・8 MiBで、`MIMIKAGO_DLSITE_CACHE_MAX_TRANSFER_BYTES` と `MIMIKAGO_DLSITE_CACHE_MAX_EXPANDED_BYTES` で変えられます。値はすべて正の整数として厳格に検証します。

期限切れの行だけを消すには `pnpm --filter @mimimilli/server dlsite-cache -- cleanup` を使います。容量と行数は `pnpm --filter @mimimilli/server dlsite-cache -- status` で確認します。容量の上限や自動削除は現在設けていないため、定期的にcleanupを実行してください。

既に手元にあるHTMLだけを取り込む場合は、ネットワークに出ず次を実行します。

```sh
pnpm --filter @mimimilli/server dlsite-cache -- import --product-code RJ123456 --file /absolute/path/work.html
```

複数ファイルをまとめて取り込む場合はディレクトリ一括importを使います（非再帰。サブディレクトリは対象外）。

```sh
pnpm --filter @mimimilli/server dlsite-cache -- import --dir /absolute/path/to/bulk-html
```

ディレクトリ一括importの対象ファイルは `<product_code>.html` または `<product_code>.html.gz` という命名規約に従います（例: `RJ123456.html`、`VJ012345.html.gz`）。product codeはファイル名から取り出して既存の `normalizeDlsiteProductCode` で検証するため、`RJ`/`VJ` + 6〜8桁の数字以外は失敗として扱います。この命名規約に合わない拡張子のファイル（`.txt` など）は対象外として無視します。実行結果は成功・失敗の件数と、失敗したファイル名・理由の一覧をJSONで返します。1件の失敗で全体の処理は止まりません。

gzip入力はheaderのmagic byte（`0x1f 0x8b`）で判定するため、単一ファイルimport（`--file`）でもディレクトリ一括importでも拡張子に関わらず自動で展開して取り込みます。圧縮サイズ（転送サイズ）・展開後サイズの両方に `MIMIKAGO_DLSITE_CACHE_MAX_TRANSFER_BYTES` / `MIMIKAGO_DLSITE_CACHE_MAX_EXPANDED_BYTES` の上限を適用します。

importはsymlink・上限超過を拒否します。実HTTPを新たに取得して試料を作ることはしません。importはHTML snapshotだけを更新し（成功記録と同じ扱い）、失敗記録には触れません。

## 一括取得（bulk）の対象

通常の一括取得（`POST /api/dlsite/bulk`、スキャン後の自動起動）は、RJコードがあり `skipped`・`applied` ではない作品（`none` / `error` / `not_found`）だけを対象にします。`applied` 済みの作品を毎回対象にすると、キャッシュhitでも `.meta.json` の `lastAttemptAt` が書き換わり続けるためです。

同じキャッシュ済みRJコードに対する2回目以降の一括取得は、適用結果に実質的な差分がなければDBにも `.meta.json` にも書き込みません。`lastAttemptAt` は実際にHTTPを試みたときだけ更新し、cache hitでは更新しません。

## offline

`MIMIKAGO_DLSITE_OFFLINE=true` にすると、作品HTML、カバー画像、リダイレクト先を含むDLsiteの実HTTPをすべて止めます。cache hitは通常どおり使えます。cache missとforceは `offline` エラーになり、キャッシュにも書き込みません。一括取得ではoffline由来の失敗を `work_dlsite.status=error` に保存しません。値は `true` または `false` だけです。未指定時は `false` です。

## レート制限と再試行

HTML、カバー、カバーの各リダイレクトは単一schedulerを通ります。実HTTPの開始時刻は `MIMIKAGO_DLSITE_REQUEST_INTERVAL_MS`（既定1000ms）以上離します。最初の1件は待機しません。

429、5xx、通信エラーは指数バックオフとjitterで再試行します。再試行回数、最大backoff、1リクエスト全体の期限はそれぞれ `MIMIKAGO_DLSITE_RETRY_COUNT`（既定3）、`MIMIKAGO_DLSITE_MAX_BACKOFF_MS`（既定30000）、`MIMIKAGO_DLSITE_TIMEOUT_MS`（既定60000）で設定します。すべて0以上の整数（timeoutは1以上）です。429と503の `Retry-After`（秒またはHTTP-date）は共有cooldownとして後続リクエストにも適用します。404とパース失敗は再試行しません。

ログには `dlsite_cache_hit`、`dlsite_cache_miss`、`dlsite_http_request`、`dlsite_http_retry` を出し、hit/missと実HTTP数を確認できます。

## 実ページ試料

実ページの試料はリポジトリにありません。新規HTTPは実行していないため、実サイズとgzip圧縮率の測定は未完です。ユーザー提供または既存取得済みの試料が得られた場合だけ、測定結果をここへ追記します。
