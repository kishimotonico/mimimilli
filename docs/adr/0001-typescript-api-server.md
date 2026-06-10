# ADR-0001: API サーバーを TypeScript（Hono）で新規開発する

- ステータス: 承認
- 日付: 2026-06-11
- 関連: [アーキテクチャ v2 提案](../architecture-v2-proposal.md)

## 文脈

Tauri 時代のサービス層を HTTP 化した Rust(axum) サーバーが `server/` に存在するが、フロントエンドのモック駆動開発が先行し、新スコープ（軸ファセット・タグAND・スマートフォルダー・`/api/fs` 物理FSブラウズ）は `client/mocks/`（TypeScript）側にのみ実装されている。Tauri 遺産は重視せず、一からの API 開発も可とする前提で実装言語を再選定した。

## 決定

API サーバーは Rust 資産を引き継がず、TypeScript で新規開発する。

- フレームワーク: Hono（ランタイム非依存。Vite dev middleware にマウント可能）
- 開発ランタイム: Node / Bun いずれも可。配布は `bun build --compile` の単一 exe を本線とし、ネイティブモジュール依存を避ける（SQLite は Drizzle 経由で `bun:sqlite` / `better-sqlite3` を切替、watcher は chokidar v4、音声メタデータは music-metadata）
- API 契約は `shared/` パッケージの Zod スキーマを正典とし、client / server が共有する

## 理由

1. API 契約の正典がすでに TypeScript（モック実装＋フロントの型）にあり、言語を揃えると契約→実装の距離が最短になる。TS/Rust の2言語構成では型の二重管理が恒常コストになり、契約のズレが結合テストまで露見しない
2. AIエージェント主体の開発では、共有スキーマ＋単一言語により契約違反を `tsc` が機械的に検出できることの価値が大きい
3. 負荷特性は I/O バウンド（音声配信は無変換のファイル転送、移動追従は UUID 突合でハッシュ不要、最重は初回スキャンの再生時間取得＝DBキャッシュで初回限り）であり、数千作品規模では Rust の性能優位が決定打にならない
4. 将来 CPU バウンド機能（波形生成等）が必要になっても ffmpeg サブプロセスや限定的なサイドカーで対応でき、言語選定に波及しない
5. ネイティブ化（トレイ常駐・ウィンドウ化）が必要になっても、Tauri v2 の sidecar や Electron で TS サーバーをそのまま同梱できるため、本決定は配布形態を制約しない

## 帰結

- `server/`（Rust）は v2 サーバーが機能同等に達した時点で削除する。スキャンフロー・`.meta.json` 自動生成規則・DLsite セレクタは仕様として吸い上げる
- リポジトリはルート pnpm workspace（`client/` / `server/` / `shared/`）に再編する
- ギャップレス再生など「Rust が欲しくなる」処理が将来出た場合は、その機能に限定したサイドカーとして追加する
