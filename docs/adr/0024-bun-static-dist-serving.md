# ADR-0024: BunサーバーでVite distを一体配信する

- ステータス: 承認
- 日付: 2026-08-21
- 関連: [ADR-0007](0007-bun-distribution-runtime.md)、[ADR-0018](0018-vite-client-bun-server-separation.md)、TASK-370

## 文脈

`pnpm dev` は Vite dev server が未バンドルモジュールを1ファイル=1リクエストで配信するため、リモート環境では往復が多く重い。本番ビルド（`client/dist`）で動作確認できる preview フローが必要になった。

ADR-0018 では開発時の transport 統一を決め、Bun が Vite dist を配信する production 経路はスコープ外とした。ADR-0007 では配布物に client 静的成果物を同梱する方針を示していたが、HTTP 配信の実装までは含めていなかった。

## 決定

- server に `MIMIMILLI_STATIC_DIR` で有効化する静的配信を追加する。未設定時は API のみ（既存挙動を維持）
- 設定時は `/api` 以外の GET/HEAD を dist から配信し、存在しないパスは `index.html` へ SPA フォールバックする
- `/assets/` 配下は `Cache-Control: public, max-age=31536000, immutable`、`index.html` は `no-cache`
- ルート package.json に `preview:fixture` / `preview:fixture:*` / `preview:real` を追加する。client build 後、`portless run --name mimi bun server/src/index.ts` で一体起動し、UI は dev と同じ `[<worktree>.]mimi.localhost:1355` で開く
- fixture シナリオ切替は既存の `MIMIMILLI_ADAPTER` / `MIMIMILLI_MOCK_SCENARIO` をそのまま使う

## 帰結

- ADR-0018 のスコープ外だった production 一体配信が preview 用途で利用できる
- dev フロー（client=`mimi`、server=`api.mimi` の2プロセス）は変更しない
- preview は watch なしの静的確認用。変更反映は再実行が必要
- 将来の zip 配布（ADR-0007）でも同じ静的配信経路を流用できる
