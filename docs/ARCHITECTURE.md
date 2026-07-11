# アーキテクチャ

本書は mimimilli の現在の構造と境界を実装ベースで説明する。開発手順・落とし穴は [HANDOFF.md](HANDOFF.md)、設計判断の経緯は [ADR-0001](adr/0001-typescript-api-server.md) / [ADR-0002](adr/0002-mock-as-fixture-adapter.md)、機能・UX 要件は [requirements-v4.md](requirements-v4.md)、未完了タスクは Backlog.md CLI（`pnpm backlog task list --plain`）を参照。

## 全体像

React 19 の SPA（`client/`）と Hono の API サーバー（`server/`）を、Zod で定義した共有契約（`shared/`）でつなぐ構成。

```text
Browser (React 19 SPA)
  │  fetch (/api/*)
  ▼
routes/        … HTTP・バリデーションだけの薄い層
  │
  ▼
core/          … 純粋なドメインロジック（検索・集計・評価）
  │
  ▼
adapters/      … データの出どころを差し替える境界
  ├─ real:     SQLite + 実ファイルシステム
  └─ fixture:  インメモリの開発データ
```

決定の経緯は [ADR-0001](adr/0001-typescript-api-server.md)（TypeScript での新規開発）と [ADR-0002](adr/0002-mock-as-fixture-adapter.md)（モックの fixture アダプタ化）を参照。

## パッケージ構成

pnpm workspace のモノレポで、`client/` / `server/` / `shared/` の3パッケージからなる。

- `client/`: feature-first 構成（`app` → `features` → `entities` → `shared`）の React SPA
- `server/`: `routes/`（HTTP層）・`core/`（ドメイン層）・`adapters/`（データ層）
- `shared/`: API 契約（Zod スキーマ + 型）と `.meta.json` スキーマの正典。`client` / `server` / fixture アダプタが同じ型を参照する

## サーバー内部の境界

サーバー内部は3層に分かれるが、過剰なレイヤリングは避ける方針で、各層の責務は最小限にとどめている。

- `routes/`（`server/src/routes/`）: HTTP とバリデーションだけを担う薄い層。ドメインロジックは持たない
- `core/`（`server/src/core/`）: 純粋関数によるドメイン処理。`worksQuery`（検索・フィルタ・ソート・ページング）、`axisFacets`（分類軸の値集計）、`smartFolder`（スマートフォルダー条件の評価）の3つがある。real アダプタは `repo.listSummaries()` で `WorkSummary[]` を全件取得し、fixture アダプタはインメモリ配列をそのまま渡す。いずれも同じ純粋関数群（`applyWorksQuery` / `buildAxisFacets` / `evalSmartFolder`）に渡して検索・集計する設計であり、SQL クエリに寄せてはいない
- `adapters/`（`server/src/adapters/`）: `DataAdapter` インターフェース（`server/src/adapter.ts`）でデータの出どころ（real | fixture）だけを差し替える。ルーターとドメインロジックは1系統のみ

新機能は `shared` → fixture アダプタ → real アダプタの順に実装を揃える（fixture が先行してよい）。

## データモデルと永続化

- `.meta.json` が Source of Truth。タイトル・タグ・分類軸情報などの作品メタデータはここに保持する
- SQLite（better-sqlite3 + Drizzle）は検索・集計用のキャッシュだが、DB 固有情報（`app_settings` / `search_presets` / `smart_folders` / ブックマーク・レジューム・最終再生・物理パス・ステータス）も同時に持つ
- UI からの編集は `.meta.json` へ即時書き戻す
- DDL（`server/src/adapters/real/db.ts` の `CREATE TABLE IF NOT EXISTS` 群）は手動同期で、互換マイグレーションは持たない。スキーマを変更したときは `user_version`（`server/src/adapters/real/schema.ts`）を上げ、起動時に不一致を検知して DB を作り直す

## 主要データフロー

- 開発時（fixture）: `client/vite.config.ts` の plugin が、fixture アダプタを注入した Hono アプリ（`createApp`）を Vite の dev middleware として `/api/*` にマウントする。`BACKEND_URL` を指定すると、代わりにそちらへプロキシする
- スキャン: `POST /api/scan` は同期実行で `ScanResult` を返す。SSE による進捗配信は未実装（backlog にタスクあり）
- メディア配信: client がメディア URL を組み立て（`entities/work/api.ts`）、`/api/media/*` ルートが `DataAdapter.locateMedia()` 経由でアダプタ（実ファイル or fixture の合成メディア）から実体を取得して配信する

## ファイルシステムと配信の安全性

`/api/fs`（物理FSブラウズ）と `/api/media/*`（メディア配信）が扱う物理パスは、すべて `server/src/adapters/real/paths.ts` の `resolveWithin` に集約してパス解決する。`realpath` で実パスに解決したうえでルートフォルダー配下にあることを検証し、配下でない・存在しない場合は `null` を返す（パストラバーサル対策）。音声配信は HTTP Range（206）に対応する。サーバーは音声のデコード・変換をしない。

## 公開範囲と配布

- サーバーの bind は `127.0.0.1` に固定している。LAN 内の別端末への公開は認証とセットで将来対応する
- 配布は `bun build --compile` による単一 exe を将来方針としているが未実装。現状は `better-sqlite3`（ネイティブ依存）を使っており、実施時には `bun:sqlite` 等の pure JS 実装への差し替えが必要になる
- システムトレイ常駐・インストーラー・コード署名も将来検討事項で、詳細設計は未着手

## 関連文書

- [ADR-0001: API サーバーを TypeScript（Hono）で新規開発する](adr/0001-typescript-api-server.md)
- [ADR-0002: モックを本実装サーバーの fixture アダプタとして統合する](adr/0002-mock-as-fixture-adapter.md)
- [requirements-v4.md](requirements-v4.md) — 機能・UX 要件
- [HANDOFF.md](HANDOFF.md) — 開発の現状・引き継ぎ
- [design-system.md](design-system.md) — フロントエンドのデザイン規約
