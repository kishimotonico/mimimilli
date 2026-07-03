# ADR-0002: モックを本実装サーバーの fixture アダプタとして統合する

- ステータス: 承認
- 日付: 2026-06-11
- 関連: [アーキテクチャ v2 提案](../architecture-v2-proposal.md)、[ADR-0001](0001-typescript-api-server.md)

## 文脈

現在は `client/mocks/`（fixtures ＋ handlers）が Vite dev middleware として `/api` に応答し、UI のモック駆動開発とビジュアルテストを支えている。本実装サーバーを別系統で作ると、モックと本実装でルーター・契約が二重になり、乖離が回帰の温床になる。

## 決定

モックを「捨てる仮実装」ではなく、本実装サーバー（ADR-0001）の fixture アダプタへ昇格させる。

- `server/` はルーター＋ドメインロジックを1系統だけ持ち、データ層を adapters（real: SQLite＋実FS / fixture: インメモリ fixtures）として差し替える
- `client/` の dev サーバーは `BACKEND_URL` 未指定時、workspace 依存で server の Hono アプリ（fixture アダプタ注入）をマウントする。`pnpm dev` 一発の DX とシナリオ切替（`MIMIMILLI_MOCK_SCENARIO`）を維持する
- Playwright ビジュアルテストも fixture アダプタ経由とし、決定的なデータで実行する
- 移行完了後、`client/mocks/` は削除する

## 理由

- モックの API 面は UI を実際に動かして検証済みの契約であり、リソース設計（works / axes / smart-folders / fs / media）は再利用価値が高い。一方ページング・エラー形式・スキャン非同期化などの周辺は契約清書時に一度だけ整える（提案 §5）
- ルーター共有により「モックでは動くが本番で壊れる」「本番にあるがモックにない」という構造的乖離が消える
- 「fixture で UI を作り込み、仕様が固まったら real アダプタを実装する」という現在の開発スタイルを、本実装後もそのまま継続できる

## 帰結

- 新機能の API は必ず shared スキーマ → fixture アダプタ → real アダプタの順で実装される（fixture が先行してよい）
- fixture アダプタは本番コードの一部としてメンテナンスされる（テスト・dev 専用の使い捨てではない）
