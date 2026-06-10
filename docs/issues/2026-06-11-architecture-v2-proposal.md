# アーキテクチャ v2 提案の作成

## 背景

モックベースのフロントエンド作り込みが形になり、次の段階（API 実装）を見据えてプロジェクトの方向性を整理・確定したいという依頼。Tauri 遺産（Rust/axum サーバー）は重視せず、一からの API 開発も可、Filesモード（物理FSファイラー）も対象に含める前提で技術選定を根本から見直した。

## 作業内容

- プロジェクト全体を調査: `client/`（feature-first + TanStack Query + Jotai + Tailwind v4、mocks/ が事実上の API 契約）、`server/`（Rust/axum 約4000行、新スコープ未対応・2026-06-05 以降更新なし）、docs 一式
- `docs/architecture-v2-proposal.md` を新規作成
  - API サーバーを TypeScript（Hono + Node 22）で新規開発する提案
  - `client/mocks/` を server の fixture アダプタへ昇格し、モックと本実装でルーター・型を共有する方式
  - pnpm workspace モノレポ（client / server / shared）、API 契約 v2（パス整理・ページング・PATCH 統合・SSE）
  - Rust 資産は仕様として吸い上げ、機能同等到達後に削除する移行プラン
- `docs/web-architecture-proposal.md` に supersede 注記を追加
- 合わせて見直すべき点を提案ドキュメント §9 に列挙（frontend-design.md 欠落、AGENTS.md の apps/web・asa/mimi 表記ズレ、requirements-v4 の Files モードフェーズ乖離、README/HANDOFF の鮮度、ページング、ADR 未起票）

## 提案承認と確定作業（同日追記）

議論の結果、提案は承認された。確認・確定した論点:

- Windows インストーラー配布（常駐サーバー＋ブラウザ起動）でも TS で問題ないこと → Bun compile 単一 exe を本線とし、ネイティブモジュール依存を避ける方針を §3.3 / §7 に追記
- モック API は「検証済み契約のプロトタイプ」であり、見直しは §5 の周辺整理（ページング・エラー形式・非同期スキャン・PATCH 統合）で足りること
- CPU バウンド処理の不在を検証（音声配信＝無変換転送、移動追従＝UUID 突合でハッシュ不要、最重は初回スキャンの再生時間取得）→ §3.4 として追記
- トレイ常駐などの「ガワ」はサーバーと分離できること。詳細設計は基本機能完成後とし、本文書には方向性のみ記載（ユーザー指示）

成果物: `docs/architecture-v2-proposal.md`（承認版へ更新）、`docs/adr/0001-typescript-api-server.md`、`docs/adr/0002-mock-as-fixture-adapter.md`

## 残タスク

- requirements-v4 のフェーズ再編（Files モードの前倒し反映）
- AGENTS.md（apps/web・asa/mimi 表記）、README / HANDOFF / DEVELOPMENT の整合（v2 実装着手時に一括）
- `docs/frontend-design.md` の作成または参照修正
