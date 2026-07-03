# docs の歩き方

mimimilli のドキュメント一覧と、どれが「現行の正」かの地図。

## 現行の正典

| ドキュメント | 役割 |
|---|---|
| [HANDOFF.md](HANDOFF.md) | 開発の現状・引き継ぎ。新セッション/エージェントはまずここ |
| [BACKLOG.md](BACKLOG.md) | 未完了タスクの一元管理 |
| [architecture-v2-proposal.md](architecture-v2-proposal.md) | 設計の基準ドキュメント（承認済み） |
| [adr/](adr/README.md) | 設計判断の記録（ADR-0001: TS APIサーバー / ADR-0002: fixture アダプタ） |
| [requirements-v4.md](requirements-v4.md) | 機能・UX 要件 |

API 契約の正典はドキュメントではなく **`shared/src/`（Zod スキーマ）**。HANDOFF の API 表は概観にすぎない。

## 規約として参照するもの

- [design_handoff_mimimilli_library/](design_handoff_mimimilli_library/README.md) — デザインシステムの規約（カラートークン・テーマ・オーバーレイ・motion・カーソル等）。**レイアウト・機能仕様の正典性は 2026-07-03 に終了**しており、UI の出発点は実装済みのフロントエンド（モック差分は課題として扱わない）

## 作業記録

- [issues/](issues/README.md) — 日々の作業記録・提案・レビュー。索引と Status 規約は issues/README.md

## 削除済み（Git 履歴に残る）

- `web-architecture-proposal.md` — architecture-v2 が置き換えた旧提案（2026-07-03 削除）
- `design-brief.md` — デザイン依頼書。役目を終えた（2026-07-03 削除）
- `DEVELOPMENT.md` — 旧 Rust 前提の開発手順。HANDOFF がカバー（2026-06-21 削除）
