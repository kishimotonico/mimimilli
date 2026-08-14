# ADR-0018: Viteをクライアント専用にし、fixtureを含むサーバー実行をBunへ統一する

- ステータス: 承認
- 日付: 2026-08-14
- 関連: ADR-0002（fixture adapter）、ADR-0007（Bun配布ランタイム）、TASK-172（idle timeout・AbortSignal）

## 文脈

fixture開発とreal開発でAPIのHTTP層が分かれている。fixture開発（`pnpm dev` 系）では、`client/vite.config.ts` のfixtureApiPluginがViteプロセス内で `server/src/app.ts` を `ssrLoadModule` し、`@hono/node-server` の `getRequestListener` でNode middlewareとして動かす。real開発と将来の配布は `Bun.serve` に `app.fetch` を直接渡す。

このためViteは、`/api` 判定、server/shared配下のwatcher、SSR module graphの手動無効化、listener再生成というサーバー固有のコードを持ち、clientは `@mimimilli/server` へdev依存している。

2経路の挙動差は実際に不具合を生んでいる。`/api` 末尾スラッシュのfixture/real差（`5e541a2`）、Bunのidle timeoutによるDLsite同期fetchの切断（TASK-172、`6296840`）はいずれもfixture開発では再現しないままrealで発現した。Bun側のidleTimeout=90秒はNode middleware経路に存在せず、SSEのチャンク間切断・AbortSignal伝播・shutdown処理もfixture経路では検証されない。serverテストは `app.request()` レベルのみで、実HTTPでtransportを検証するテストがない。

一方で統一の土台はすでにある。`server/src/index.ts` は `MIMIMILLI_ADAPTER=fixture` でfixture adapterを `Bun.serve` 上で起動でき、real開発用の `MIMIMILLI_BACKEND_SERVICE` によるVite proxy（portless経由）も動いている。API接続先はclient側で `API_BASE = "/api"` に一元化済みで、origin直書きはない。

将来構想としてTauri Desktop/Mobileがあり、その場合もViteはWebViewクライアントのビルド、BunはPC上のサーバーという分担になる。ただしこの分離はTauriを採用しなくても単独で成立する。

## 決定

Viteをクライアント専用のtoolchainとし、サーバー実行は開発・fixture・real・配布のすべてでBunに統一する。

- fixture開発もBunプロセス（`MIMIMILLI_ADAPTER=fixture` + `bun --watch`）で起動し、Viteはfixture/real共通でproxyだけを持つ
- vite.config.tsからfixtureApiPlugin、`@hono/node-server`、server/shared watcher、module graph無効化を削除する。clientの `@mimimilli/server` dev依存も外す
- `pnpm dev` はViteとBunを並列起動し、一コマンドの開発体験を維持する（現行 `dev:real` と同じ形）
- 実 `Bun.serve` を通すtransport smokeを追加し、SSE・Range・idleTimeout・AbortSignal・shutdownを実HTTPで検証する

次は今回のスコープに含めない。

- `ServerConnection` のような接続先抽象の導入。`API_BASE` 一元化で足りており、Tauri着手時に判断する
- BunがVite distを配信するproduction経路とパッケージング。配布はDRAFT-1の方針どおり機能充実後
- Tauri・LAN公開・認証まわりの設計

## 帰結

- fixtureとrealが同じtransportとlifecycle（idleTimeout、signal、shutdown）を通り、「realでしか出ないバグ」の温床が消える
- Viteの責務がclient HMR・build・Vitestだけになり、vite.config.tsのサーバー固有コード約70行と `@hono/node-server` 依存が消える
- 開発時はVite+Bunの2プロセスになる。fixtureのin-memory状態は `bun --watch` の再起動でリセットされるが、これは現行のlistener再生成と同じ挙動
- Playwright smokeの `webServer` はfixture plugin前提（Vite起動＝API起動）を作り直す必要がある。Bun fixtureサーバーとViteの2本構成にし、ヘルスチェックはBun側へ向ける
- worktree開発では、Bunサーバー側もportlessのブランチ名サブドメインで分離されることを確認する
- fixture/real両adapterの業務規則重複（resume検証、DLsite適用、登録チェックなど）はこの分離では解消しない。application service化として別途扱う
