# docs の歩き方

mimimilli のドキュメント一覧と、どれが「現行の正」かの地図。

## 現行の正典

| ドキュメント                             | 役割                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [HANDOFF.md](HANDOFF.md)                 | 開発の現状・引き継ぎ。新セッション/エージェントはまずここ                                         |
| [../backlog/](../backlog/)               | 未完了タスクの一元管理（Backlog.md CLI。`pnpm backlog task list --plain` で一覧、直接編集は禁止） |
| [ARCHITECTURE.md](ARCHITECTURE.md)       | 現在の構造・境界・データフロー                                                                    |
| [adr/](adr/README.md)                    | 設計判断の記録（いつ書くかの基準・命名・テンプレートは adr/README.md、一覧は adr/ ディレクトリ）  |
| [requirements-v4.md](requirements-v4.md) | 機能・UX 要件                                                                                     |
| [dlsite.md](dlsite.md)                   | DLsite連携（取得・タグ変換・キャッシュ・レート制限・運用手順）                                    |

API 契約の正典はドキュメントではなく **`shared/src/`（Zod スキーマ）**、エンドポイントの一覧は `server/src/routes/`。

## 規約として参照するもの

- [design-system.md](design-system.md) — デザインシステムの規約（カラートークン・テーマ・z-index・motion・カーソル・アイコン等）。実装から読み取れない設計意図・規約だけを抜粋したもので、レイアウト・機能の正は実装済みのフロントエンド。アイコンライブラリ選定の経緯は [ADR-0009](adr/0009-icon-library-lucide.md)
- [client-error-handling.md](client-error-handling.md) — client のエラー所有権・Promise 契約・best-effort 失敗の基準（[ADR-0015](adr/0015-client-error-contracts.md)）
