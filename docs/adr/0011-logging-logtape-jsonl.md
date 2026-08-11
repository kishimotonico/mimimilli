# ADR-0011: ロギング基盤にLogTapeとmessage中心JSONLを採用する

- ステータス: 承認
- 日付: 2026-08-02
- 関連: backlog TASK-168〜173、ADR-0007（データルート配置）

## 文脈

serverのログはconsole出力のみで永続化されず、常駐利用ではターミナルを閉じると失われる。特にDLsite連携は外部サイト依存でパース状況を後から追跡できず、Windows実機での動作確認で診断手段の不足が問題になった。分散トレーシングや外部監視はローカル単一ユーザーアプリに釣り合わないため、ファイルで追跡できる最小の基盤だけを導入する。

ライブラリはLogTapeを採用した。公式にBun対応を明言し、終了時のsink自動disposeがBunでも動作し、JSON Linesフォーマッタを標準搭載する。pinoはメンテナがBun非サポートを明言しており、`bun build --compile` でtransportのworker thread解決が壊れる既知問題があるため控えとした。TASK-168のスパイクで、WSLのcompile単一バイナリからfile sinkのJSONL書き込みとflushを実証し、Windowsネイティブでも書き込みを確認した。バッファ既定のまま `process.exit()` すると末尾が欠落するため、終了経路では必ず `dispose()` を通す。

## 決定

ログレコードは日本語の自由文 `message` を主役とし、必須フィールドは `ts` / `level`（debug·info·warn·error）/ `category`（dlsite·scan·db·http·server）/ `message` の4つとする。イベントIDの事前登録カタログは作らない。後から絞り込みに使う値（workId・status・durationMs・errorKind等）は文中だけでなく文脈フィールド（properties）にも入れる。これが機械可読性の担保で、ルールはこれだけとする。

出力はstdout（console sink）とファイル（file sink）の2系統。ファイルはデータルート配下 `log/server-YYYY-MM-DD.jsonl`（ADR-0007の配置に従う）で、ローテーション機構は作らず起動時にN日より古いファイルを削除するのみとする。file sinkはrealアダプタ起動時のみ有効にし、fixture・テストではconsoleのみとする。

出力先ごとの最低レベルは次のとおり。logger設定の `lowestLevel` は全カテゴリ `debug` のままとし、sink単位で絞り込む。

| 出力先        | 最低レベル | 実装                                   |
| ------------- | ---------- | -------------------------------------- |
| console       | info以上   | `withFilter(getConsoleSink(), "info")` |
| file（JSONL） | debug以上  | `getStreamFileSink` にそのまま流す     |

HTTPアクセスログの2xx/3xxは `debug` で記録するため、コンソールには出ずJSONLのみに残る。4xxは `warn`、5xxは `error` でコンソールにも出る。

file sinkは `@logtape/file` の `getStreamFileSink` を使う。同期 `getFileSink` はエンコード後200バイト未満のレコードを都度 `fsync` するため、通常運用での小レコード連発（HTTPアクセスログ等）に不向き。`highWaterMark` は64KB（`LOG_FILE_HIGH_WATER_MARK`）とし、Node.js `WriteStream` のバッファリングに任せる。graceful shutdown では `dispose()` がストリームの `end`/`close` を待ち、バッファ内容の flush を保証する。

あわせてプロセスの安全網（uncaught例外の最終記録、graceful shutdownでのdispose、Hono onErrorのlogger化）を基盤の一部として持つ。

## 帰結

- ログの追跡は `rg` / `jq` で行える。UIからの閲覧機能は作らない
- client/serverで単一のreporterは共有しない。clientはUI通知（ErrorBoundary）、serverは診断ログと責務を分ける
- DBスキーマ不一致時の無警告削除は廃止し、バックアップ退避とdbカテゴリのログ記録に置き換えた（退避バックアップは自動削除しない）
- 長時間の同期応答はBun.serveのアイドル切断（既定10秒）に掛かるため、`idleTimeout: 90` とrequest.signalの配線で整合させた
- pinoへ切り替える場合はtransportなし・`pino.destination()` 構成とし、compileバイナリでの実測を通す
