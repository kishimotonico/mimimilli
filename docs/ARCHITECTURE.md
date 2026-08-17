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
- `shared/`: API 契約（Zod スキーマ + 型）と `mimimilli.json` スキーマの正典。`client` / `server` / fixture アダプタが同じ型を参照する

## レイヤ境界の機械的検証

依存方向は lint と境界スクリプトで固定する。`pnpm check` に含まれる。

**client**（`.oxlintrc.json` + `scripts/check-layer-boundaries.mjs`）:

- `features` 間の sibling import 禁止。複数 feature で共有する state・操作は `shared/model/` か `entities/` へ引き上げる
- `features` → `app` の import 禁止（`app` → `feature` の composition は許可）
- `entities`・`shared` への依存は許可。`shared` と `entities` は上位レイヤー（`features` / `app`）へ依存しない

**server**（`.oxlintrc.json` + `scripts/check-layer-boundaries.mjs`）:

- `routes/` → `adapters/`（`real` / `fixture` 含む）の直接 import 禁止。HTTP 層は `server/src/adapter/` の `DataAdapter` 境界を経由する
- `adapters/` → `routes/` 禁止
- `core/` → `routes/` / `adapters/` 禁止
- `adapters/fixture/` ↔ `adapters/real/` の相互 import 禁止

oxlint の `overrides[].files` は `**/…` 形式で書く（複数セグメントの相対パスは一致せず silent に無効化される）。

## サーバー内部の境界

サーバー内部は3層に分かれるが、過剰なレイヤリングは避ける方針で、各層の責務は最小限にとどめている。

- `routes/`（`server/src/routes/`）: HTTP とバリデーションだけを担う薄い層。ドメインロジックは持たない
- `core/`（`server/src/core/`）: 純粋関数によるドメイン処理。`worksQuery`（検索・フィルタ・ソート・ページング）、`axisFacets`（分類軸の値集計）、`smartFolder`（スマートフォルダー条件の評価・ソート・ページング）の3つがある。fixture アダプタはインメモリ配列をこの純粋関数群（`applyWorksQuery` / `buildAxisFacets` / `evalSmartFolder`）に渡して検索・集計する
- real アダプタの検索・ファセット集計は SQL で行う。`WorkQueryRepository` の `queryWorks()` が catalog に user を ATTACH した JOIN で件数とページを同じ絞り込み集合から求め（ADR-0008）、`getAxisFacets()` がタグ軸専用 SQL を含むファセット集計を担う。SQL フラグメントは `workQuerySql.ts` に集約する。日本語ソートキー（`japaneseSortKey`）は書き込み時に列へ事前計算する。SQL と core 純粋関数の結果が一致することは `server/tests/real/worksQueryContract.test.ts` の同値性契約テストで担保する。スマートフォルダー評価だけは real でも `listSummaries()` + `evalSmartFolder` を使い、戻り値は `WorksPage`（ページングエンベロープ）である
- `adapters/`（`server/src/adapters/`）: `DataAdapter` インターフェース（`server/src/adapter.ts`）でデータの出どころ（real | fixture）だけを差し替える。ルーターとドメインロジックは1系統のみ

新機能は `shared` → fixture アダプタ → real アダプタの順に実装を揃える（fixture が先行してよい）。

## データモデルと永続化

- `mimimilli.json` が Source of Truth。タイトル・タグ・分類軸情報などの作品メタデータはここに保持する
- SQLiteは `bun:sqlite` + Drizzleを使い、`catalog.sqlite` と `user.sqlite` に分ける。catalogには作品メタ・走査状態・派生キャッシュ、userには設定・プリセット・スマートフォルダー・ブックマーク・レジューム・最終再生を置く
- catalog接続をmainとしてuser DBを `user` でATTACHし、作品とuser状態をJOINして読む。DB間外部キーとcascade deleteは使わない
- 作品詳細のトラック尺は、音声ファイルの size/mtime と `audio_probe_cache` を照合し、不一致なら再プローブする（`workProbe.ts`）。`GET /works/:id` は読み取り後に `catalog.total_duration_sec` をライブ合計へ同期する（`workRefresh.ts` 経由）。一覧の `totalDurationSec` ソート・表示はこの保存列を読むため、詳細取得を経ると一覧にも反映される。再スキャンは不要
- UI からの編集は `mimimilli.json` へ即時書き戻す
- スキーマの正本は `catalogSchema.ts` / `userSchema.ts` のDrizzle定義。`pnpm --filter @mimimilli/server db:generate` で生成したSQLを、起動時に自前のmigration executor（`sqliteMigrationExecutor.ts`、[ADR-0021](adr/0021-custom-sqlite-migration-executor.md)）で適用する。catalogは `user_version` 不一致で退避・再作成し、userはpre-migrationバックアップ後に候補DBへforward migrationを適用してから現行DBと入れ替える（[ADR-0008](adr/0008-persistence-topology-query-ownership-playback-ids.md)）
- データルートはADR-0007に従い、Linuxでは `${XDG_DATA_HOME:-$HOME/.local/share}/mimimilli`、Windowsでは `%LOCALAPPDATA%\mimimilli`。`MIMIMILLI_DATA_DIR` で上書きできる

## 主要データフロー

- 開発時（fixture）: server（Bun、`MIMIMILLI_ADAPTER=fixture`）と client（Vite）を別々の portless サービスとして起動する。client は Vite proxy で同じ worktree の `api.mimi` へ接続する
- 開発時（real）: server と client を別々の portless サービスとして起動する。client は Vite proxy で同じ worktree の `api.mimi` へ接続する
- スキャン: `POST /api/scan` はジョブを開始して 202 とスナップショットを即返す（`Location: /api/scan/:id`）。同時実行は1件のみで、実行中の二重POSTは409。進捗は `GET /api/scan/:id/events` の SSE で配信し、`Last-Event-ID` で欠損イベントをリプレイする（履歴切れ時は `reset` で現スナップショットを送る）。進捗無音区間は15秒間隔の `ping` で接続を維持。`GET /api/scan/active` で実行中ジョブを取得、`GET /api/scan/last` で直近完了結果（メモリ保持）を取得する
- メディア配信: client がメディア URL を組み立て（`entities/work/api.ts`）、`/api/media/*` ルートが `DataAdapter.locateMedia()` 経由でアダプタ（実ファイル or fixture の合成メディア）から実体を取得して配信する

## ファイルシステムと配信の安全性

`/api/fs`（物理FSブラウズ）と `/api/media/*`（メディア配信）が扱う物理パスは、すべて `server/src/adapters/real/paths.ts` の `resolveWithin` に集約してパス解決する。`realpath` で実パスに解決したうえでルートフォルダー配下にあることを検証し、配下でない・存在しない場合は `null` を返す（パストラバーサル対策）。音声配信は HTTP Range（206）に対応する。サーバーは音声のデコード・変換をしない。

## 公開範囲と配布

- サーバーの bind は `127.0.0.1` に固定している。LAN 内の別端末への公開は認証とセットで将来対応する
- 開発serverと配布ランタイムはBunを使う。Windows配布物はsharpの外部資産を含むzipを前提とし、compile・実機smokeは配布タスクで整備する
- システムトレイ常駐・インストーラー・コード署名も将来検討事項で、詳細設計は未着手

## 関連文書

- [ADR-0001: API サーバーを TypeScript（Hono）で新規開発する](adr/0001-typescript-api-server.md)
- [ADR-0002: モックを本実装サーバーの fixture アダプタとして統合する](adr/0002-mock-as-fixture-adapter.md)
- [ADR-0007: Windows配布ランタイムにBunを使う](adr/0007-bun-distribution-runtime.md)
- [ADR-0008: 永続化トポロジー・検索所有権・再生IDを分離する](adr/0008-persistence-topology-query-ownership-playback-ids.md)
- [requirements-v4.md](requirements-v4.md) — 機能・UX 要件
- [HANDOFF.md](HANDOFF.md) — 開発の現状・引き継ぎ
- [design-system.md](design-system.md) — フロントエンドのデザイン規約
