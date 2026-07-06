# docs の歩き方

mimimilli のドキュメント一覧と、どれが「現行の正」かの地図。

## 現行の正典

| ドキュメント                             | 役割                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| [HANDOFF.md](HANDOFF.md)                 | 開発の現状・引き継ぎ。新セッション/エージェントはまずここ                                    |
| [../backlog/](../backlog/)               | 未完了タスクの一元管理（Backlog.md CLI。`backlog task list --plain` で一覧、直接編集は禁止） |
| [ARCHITECTURE.md](ARCHITECTURE.md)       | 現在の構造・境界・データフロー                                                               |
| [adr/](adr/README.md)                    | 設計判断の記録（いつ書くかの基準・一覧は adr/README.md）                                     |
| [requirements-v4.md](requirements-v4.md) | 機能・UX 要件                                                                                |

API 契約の正典はドキュメントではなく **`shared/src/`（Zod スキーマ）**。HANDOFF の API 表は概観にすぎない。

## 規約として参照するもの

- [design-system.md](design-system.md) — デザインシステムの規約（カラートークン・テーマ・z-index・motion・カーソル等）。実装から読み取れない設計意図・規約だけを抜粋したもので、レイアウト・機能の正は実装済みのフロントエンド

## 作業記録

- [issues/](issues/README.md) — 過去の作業記録アーカイブ（2026-07-06 凍結。新規追加・編集はしない）。以降の作業記録は backlog のタスクに集約

## 削除済み（Git 履歴に残る）

- `web-architecture-proposal.md` — のちの architecture-v2 提案（これも削除済み）が置き換えた旧提案（2026-07-03 削除）
- `architecture-v2-proposal.md` — 移行完了により ARCHITECTURE.md へ再構成（2026-07-04 削除）
- `design-brief.md` — デザイン依頼書。役目を終えた（2026-07-03 削除）
- `design_handoff_mimimilli_library/` — UIデザインモック一式。要点は design-system.md へ抽出（2026-07-03 削除）
- `DEVELOPMENT.md` — 旧 Rust 前提の開発手順。HANDOFF がカバー（2026-06-21 削除）
