# ADR-0002: モックを本実装サーバーの fixture アダプタとして統合する

- ステータス: 承認
- 日付: 2026-06-11
- 関連: [../ARCHITECTURE.md](../ARCHITECTURE.md)、[ADR-0001](0001-typescript-api-server.md)、[ADR-0018](0018-vite-client-bun-server-separation.md)（dev サーバーへのマウントを Bun プロセスの別起動へ改訂）

## 文脈

現在は `client/mocks/`（fixtures ＋ handlers）が Vite dev middleware として `/api` に応答し、UI のモック駆動開発とビジュアルテストを支えている。本実装サーバーを別系統で作ると、モックと本実装でルーター・契約が二重になり、乖離が回帰の温床になる。

## 決定

モックを「捨てる仮実装」ではなく、本実装サーバー（ADR-0001）の fixture アダプタへ昇格させる。

- `server/` はルーター＋ドメインロジックを1系統だけ持ち、データ層を adapters（real: SQLite＋実FS / fixture: インメモリ fixtures）として差し替える
- `client/` の dev サーバーはrealバックエンドサービスが指定されていないとき、workspace 依存で server の Hono アプリ（fixture アダプタ注入）をマウントする。`pnpm dev` 一発の DX とシナリオ切替（`MIMIMILLI_MOCK_SCENARIO`）を維持する（[ADR-0018](0018-vite-client-bun-server-separation.md) で改訂）
- Playwright ビジュアルテストも fixture アダプタ経由とし、決定的なデータで実行する
- `client/mocks/` は置かない

## 理由

- モックの API 面は UI を実際に動かして検証済みの契約であり、リソース設計（works / axes / smart-folders / fs / media）は再利用価値が高い。一方ページング・エラー形式・スキャン非同期化などの周辺は契約清書時に一度だけ整える（提案 §5）
- ルーター共有により「モックでは動くが本番で壊れる」「本番にあるがモックにない」という構造的乖離が消える
- 「fixture で UI を作り込み、仕様が固まったら real アダプタを実装する」という現在の開発スタイルを、本実装後もそのまま継続できる

## 帰結

- 新機能の API は必ず shared スキーマ → fixture アダプタ → real アダプタの順で実装される（fixture が先行してよい）
- fixture アダプタは本番コードの一部としてメンテナンスされる（テスト・dev 専用の使い捨てではない）
- fixture アダプタは `server/src/adapters/fixture/` にあり、`MIMIMILLI_MOCK_SCENARIO` によるシナリオ切替と、音声・カバー画像の合成メディア配信を持つ
- fixture アダプタは検索・集計を core の純粋関数に渡して行う。real アダプタとの検索ロジックの分担は [ADR-0008](0008-persistence-topology-query-ownership-playback-ids.md) に従う
