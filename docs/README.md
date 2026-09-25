# docs の歩き方

mimimilli のドキュメント一覧と、どれが「現行の正」かの地図。

## 現行の正典

| ドキュメント                             | 役割                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [HANDOFF.md](HANDOFF.md)                 | 開発の現状・引き継ぎ。新セッション/エージェントはまずここ                                         |
| [../backlog/](../backlog/)               | 未完了タスクの一元管理（Backlog.md CLI。`pnpm backlog task list --plain` で一覧、直接編集は禁止） |
| [ARCHITECTURE.md](ARCHITECTURE.md)       | 現在の構造・境界・データフロー                                                                    |
| [adr/](adr/README.md)                    | 設計判断の記録（いつ書くかの基準・一覧は adr/README.md）                                          |
| [requirements-v4.md](requirements-v4.md) | 機能・UX 要件                                                                                     |
| [dlsite.md](dlsite.md)                   | DLsite連携（取得・タグ変換・キャッシュ・レート制限・運用手順）                                    |

API 契約の正典はドキュメントではなく **`shared/src/`（Zod スキーマ）**。HANDOFF の API 表は概観にすぎない。

## 規約として参照するもの

- [design-system.md](design-system.md) — デザインシステムの規約（カラートークン・テーマ・z-index・motion・カーソル・アイコン等）。実装から読み取れない設計意図・規約だけを抜粋したもので、レイアウト・機能の正は実装済みのフロントエンド。アイコンライブラリ選定の経緯は [ADR-0009](adr/0009-icon-library-lucide.md)
- [client-error-handling.md](client-error-handling.md) — client のエラー所有権・Promise 契約・best-effort 失敗の基準（[ADR-0015](adr/0015-client-error-contracts.md)）

## 作業記録

- [issues/](issues/README.md) — 過去の作業記録アーカイブ（2026-07-06 凍結。新規追加・編集はしない）。以降の作業記録は backlog のタスクに集約

## 削除済み（Git 履歴に残る）

- `architecture-review-2026-09-20.md`、`specification-review-2026-09-20.md` — 2026-09-20のアーキテクチャ・仕様レビュー。指摘はADR-0025〜0032とTASK-465〜470へ反映済み、残りはTASK-338へ引き継ぎ済み（2026-09-25削除）
- `dlsite-flow-review-2026-09-21.md`（と `assets/dlsite-flow-review-2026-09-21/`）— スキャンとDLsite連携の調査・再設計案。未採用で、論点はDRAFT-74・76へ引き継ぎ済み（2026-09-25削除）
- `review-todo-2026-09-20.md`、`core-design-review-2026-09-20.md`、`core-design-review-scope-2026-09-20.md`、`data-lifecycle-review-2026-09-21.md`、`design-contract-review-2026-09-21.md`、`review-handoff-answers-2026-09-21.md`、`review-handoff-answers-2-2026-09-21.md`、`change-simulation-2026-09-20.md` — 2026-09-20〜21のAstra設計レビュー群のうち、指摘がADR-0025・0026・TASK-452〜463へ実装済み、またはTASK-465〜470・338へ引き継ぎ済みのもの（2026-09-24削除）
- `application-architecture-review-2026-08-12.md` — 2026-08-12の設計レビュー。指摘はADR-0006・0017・0023・0025・0026とTASK群（309・310・313・315・317〜320・324・356・452〜470・338）へ移行済み（2026-09-24削除）
- `web-architecture-proposal.md` — のちの architecture-v2 提案（これも削除済み）が置き換えた旧提案（2026-07-03 削除）
- `architecture-v2-proposal.md` — 移行完了により ARCHITECTURE.md へ再構成（2026-07-04 削除）
- `design-brief.md` — デザイン依頼書。役目を終えた（2026-07-03 削除）
- `design_handoff_mimimilli_library/` — UIデザインモック一式。要点は design-system.md へ抽出（2026-07-03 削除）
- `DEVELOPMENT.md` — 旧 Rust 前提の開発手順。HANDOFF がカバー（2026-06-21 削除）
