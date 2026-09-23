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

## 設計検討資料

- [後任レビュー担当への回答 2026-09-21](review-handoff-answers-2026-09-21.md) — 確認経路、反証での変更、推奨理由・優先順位、DLsiteへ渡す契約とドラフト照合
- [データの寿命と作品identityのレビュー 2026-09-21](data-lifecycle-review-2026-09-21.md) — 再構築・復元・root変更で保持する状態と、作品の所有範囲
- [正本編集と検索の契約比較 2026-09-21](design-contract-review-2026-09-21.md) — 編集snapshot、保存単位、反映失敗、分類の対象についての仕様案比較
- [設計レビューの引き継ぎTODO 2026-09-20](review-todo-2026-09-20.md) — 次のレビューの優先順、調査対象、コード入口、完了条件
- [コア設計レビュー 2026-09-20](core-design-review-2026-09-20.md) — 編集snapshot・保存単位・操作結果・検索対象の契約を横断評価
- [コア設計レビューの調査方針 2026-09-20](core-design-review-scope-2026-09-20.md) — 並行調査向けに公開した対象と方法。調査完了
- [アーキテクチャレビュー 2026-09-20](architecture-review-2026-09-20.md) — master `119aef15` の静的レビュー。改善案と既存設計の評価であり、現行仕様の正典ではない
- [仕様・拡張性レビュー 2026-09-20](specification-review-2026-09-20.md) — 仕様の単純化、状態の寿命、データ量に応じた処理構造、UIの複雑さの評価
- [機能追加の変更シミュレーション 2026-09-20](change-simulation-2026-09-20.md) — 個人評価とFilesからの作品編集を題材に、必要な変更と構造による余計な波及を区別

## 規約として参照するもの

- [design-system.md](design-system.md) — デザインシステムの規約（カラートークン・テーマ・z-index・motion・カーソル・アイコン等）。実装から読み取れない設計意図・規約だけを抜粋したもので、レイアウト・機能の正は実装済みのフロントエンド。アイコンライブラリ選定の経緯は [ADR-0009](adr/0009-icon-library-lucide.md)
- [client-error-handling.md](client-error-handling.md) — client のエラー所有権・Promise 契約・best-effort 失敗の基準（[ADR-0015](adr/0015-client-error-contracts.md)）

## 作業記録

- [issues/](issues/README.md) — 過去の作業記録アーカイブ（2026-07-06 凍結。新規追加・編集はしない）。以降の作業記録は backlog のタスクに集約

## 削除済み（Git 履歴に残る）

- `web-architecture-proposal.md` — のちの architecture-v2 提案（これも削除済み）が置き換えた旧提案（2026-07-03 削除）
- `architecture-v2-proposal.md` — 移行完了により ARCHITECTURE.md へ再構成（2026-07-04 削除）
- `design-brief.md` — デザイン依頼書。役目を終えた（2026-07-03 削除）
- `design_handoff_mimimilli_library/` — UIデザインモック一式。要点は design-system.md へ抽出（2026-07-03 削除）
- `DEVELOPMENT.md` — 旧 Rust 前提の開発手順。HANDOFF がカバー（2026-06-21 削除）
