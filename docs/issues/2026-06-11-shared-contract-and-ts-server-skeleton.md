# shared 契約パッケージと TS サーバー骨格の実装（移行プラン ステップ1〜2）

## 背景

アーキテクチャ v2（`docs/architecture-v2-proposal.md`、ADR-0001/0002）の承認を受け、移行プランのステップ1（契約確定）とステップ2（server 骨格 + fixture アダプタ）に着手した。client/ ではモック作り込みが並行進行中のため、**client/ には一切手を入れない**制約で進めた。

## 作業内容

### リポジトリ再編

- Rust サーバーを `server/` → `server-rust/` へ移動（参照実装として保持。real アダプタが機能同等に達したら削除）
- ルートに pnpm workspace を新設（`server` + `shared`）。`client/` は並行作業への影響を避けるため独立 workspace のまま（fixture アダプタ統合の完了時に合流させる）

### shared/ — API 契約 v2（Zod スキーマ）

`@mimimilli/shared` として、work / meta（`.meta.json`）/ library（ソート・軸・スマートフォルダー・プリセット）/ fs / settings / scan / dlsite / api（クエリ・エンベロープ・エラー形式）を定義。契約上の主な決定:

- `GET /api/works` はページングエンベロープ `{items, total}` を返す（page/limit 未指定時は全件）
- 旧 PUT tags / PUT title / POST bookmark は `PATCH /api/works/:id` に統合
- エラーは常に `{error: {code, message}}`（not_found / invalid_request / conflict / internal）
- パス体系を統一: `/api/axes/:axis`, `/api/smart-folders`, `/api/media/{cover,audio,file}`
- スキャンは当面同期実行で ScanResult を返す。SSE（`/api/scan/events`）は体験改善フェーズで追加し 202 化する

### server/ — Hono サーバー骨格（Node 24 ネイティブ TS 実行、ビルドなし）

- `adapter.ts`: DataAdapter 境界（fixture / real の差し替え点）
- `core/`: pure 関数（worksQuery / axisFacets / smartFolder eval）。モックハンドラーのセマンティクスを移植
- `routes/`: 全エンドポイント。Zod バリデーション、audio の HTTP Range（206/416）対応済み
- `adapters/fixture/`: 自己完結のシードデータ（作品10件・SF2件・プリセット2件・fsツリー）による DataAdapter 実装
- `tests/`: node:test 30件（core ユニット + app.request() による結合）

ルート実装の大部分は Sonnet エージェントに委譲し、契約設計・アダプタ境界・レビューは Claude が担当した。

## 検証

- `pnpm check`（shared + server の tsc --noEmit）: エラーなし
- `pnpm test:server`: 30件全パス
- fixture サーバー起動スモーク: works 検索（タグ・ソート・ページング）、settings、404 エラー形式、/fs を確認

## 次のステップ

- ステップ3: real アダプタ（SQLite + Drizzle、scanner、`.meta.json` 読み書き、メディア配信の実体）
- client 合流: モック作業の完了後、`client/mocks/` を fixture アダプタへ置き換え、`api.ts` 群を `@mimimilli/shared` の型へ差し替え、Vite dev middleware を server マウントに切り替える
- 既知の契約差分（client 側の追従が必要）: works のエンベロープ化、PATCH 統合、パス変更（axes / smart-folders / media）、`GET /works/:id` が null ではなく 404 を返す
