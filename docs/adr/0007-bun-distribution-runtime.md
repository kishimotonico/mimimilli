# ADR-0007: Windows配布ランタイムにBunを使う

- ステータス: 承認
- 日付: 2026-07-19
- 関連: backlog TASK-70、DRAFT-27（DB分離）、DRAFT-1（配布）、[Bun配布スパイク](../../scripts/spike/bun-distribution/README.md)

## 文脈

現行serverはNode.js上で `@hono/node-server`、`better-sqlite3`、sharpを使い、DBを作業ディレクトリ相対に置く。Windows向け単体exeへ移すには、cross-compileが通るだけでなく、SQLiteの作成、migration、停止、再起動後の読み込みが必要になる。native addonはcompile時に実行可能性を検査されないため、依存ごとに実行とcompileを分けて確認した。

Bun 1.3.14を使ったTASK-70のスパイクでは、`bun:sqlite` がcatalog/userの2DB同時接続と `ATTACH` を含む永続化試験を通過した。Hono + `Bun.serve` の最小serverも、HTTP経由の書き込みを停止後に再読み込みできた。WSLから `bun-windows-x64` をtargetにしたPE32+ exe生成も成功した。

`better-sqlite3` 12.10.0はexeを生成できるが、Bun上の実行時に `ERR_DLOPEN_FAILED` と未対応のエラーになる。`@hono/node-server` はBun上で応答でき、Windows exeも生成できたものの、実行時にResponse互換層の警告を出した。sharpはLinux上では動くが、Windows target用addonとDLLを取得しても、それらが単一exeへ内蔵されたことは確認できなかった。

## 決定

### HTTPとSQLite

配布serverのランタイムをBunとし、Honoの `app.fetch` を `Bun.serve` へ直接渡す。`@hono/node-server` はNode.js開発経路で必要な間だけ残せるが、配布entryからは外す。

SQLiteドライバは `bun:sqlite` を採用する。DB分離ではcatalogとuserを別ファイルで同時に開く。単純な結合や一括更新で必要になった場合はcatalog接続からuser DBを `ATTACH` する。現行の `drizzle-orm/better-sqlite3` adapterは流用せず、TASK-71以降で `bun:sqlite` 対応adapterへ置き換える。

### sharpとアプリ資産

sharpを単一exeに入る前提にしない。初期のWindows配布物は単一ファイルではなくディレクトリまたはzipとし、sharpのWindows x64 addonとDLLを読み取り専用のアプリ資産としてexeと一緒に配る。配布buildではsharpを外部依存にし、Windows実機で外部ロードと画像変換を確認する。これが安定しない場合は画像変換をNode.js sidecarへ分離する。native addonが動かない状態をサムネイルなしで隠すfallbackは設けない。

clientの静的成果物も同じアプリ資産に置く。BunのHTML埋め込みは使えるが、今回の永続化試験では検証していないため初期設計の前提にしない。

### ユーザーデータ

Windowsの既定データルートを `%LOCALAPPDATA%\Mimikago` とする。catalog DB、user DB、生成cache、logはその配下に用途別に置き、exeやclient資産の配置先と分離する。開発、テスト、portable運用のため `MIMIKAGO_DATA_DIR` でルートを上書きできるようにする。

Linuxでは `${XDG_DATA_HOME:-$HOME/.local/share}/mimikago` を使う。相対指定を受け付ける場合は起動時に絶対パスへ解決し、各adapterへ絶対パスを渡す。通常起動で作業ディレクトリやexeの隣へDBを作らない。

## 帰結

- Bun配布経路ではDB adapterと起動entryの変更が必要になる。既存server本体への反映はTASK-70の範囲外
- `better-sqlite3` のcompile成功を互換性の根拠にできない。Bunの対応状況が変わっても、採用変更には同じ永続化smokeを通す
- 配布物は当面zip単位となり、単一exeという見た目は諦める。ユーザーデータは配布物の更新・移動・削除から保護される
- Windows実機で本命exeの2回起動を確認する。手順は [WINDOWS-SMOKE.md](../../scripts/spike/bun-distribution/WINDOWS-SMOKE.md) に置く
- sharpの外部ロード方式は配布build実装時の検証項目として残る。外部ロードに失敗した場合は明示的な起動・処理エラーにする
