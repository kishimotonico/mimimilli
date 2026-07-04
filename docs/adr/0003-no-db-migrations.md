# ADR-0003: DB に互換マイグレーションを持たない

- ステータス: 承認（実装済み）
- 日付: 2026-07-04
- 関連: [ADR-0004](0004-core-functions-over-sql.md)、[../ARCHITECTURE.md](../ARCHITECTURE.md)

## 文脈

SQLite（`server/src/adapters/real/db.ts` / `schema.ts`）は `.meta.json`（Source of Truth）から再スキャンで再構築できる検索キャッシュだが、`.meta.json` には持たない DB 固有情報（`app_settings`・`search_presets`・`smart_folders`、および `works` テーブルの `bookmarked`・`last_played_at`・`resume_position`・`resume_track_index`）も同居している。

## 決定

互換マイグレーションの仕組みは持たない。

- DDL は `db.ts` の `CREATE TABLE IF NOT EXISTS` 群として定義し、Drizzle の `schema.ts` と手動で同期する
- スキーマを変更したときは `db.ts` の `SCHEMA_VERSION` を上げる
- 起動時に SQLite の `user_version` プラグマと `SCHEMA_VERSION` を比較し、不一致（かつ `user_version` が初期値の 0 でない）であれば例外を投げて起動を止め、キャッシュ DB を削除して再スキャンするようユーザーに促す。マイグレーションによる自動移行は行わない

## 帰結

- マイグレーションの実装・テストのコストがゼロになる
- スキーマ変更のたびに DB 固有情報（設定・プリセット・スマートフォルダー・ブックマーク・レジューム・最終再生日時）が失われる。再スキャンで戻るのは `.meta.json` 由来の情報のみ
- DB 固有情報が増えて損失の影響が無視できなくなったら、本 ADR を見直してエクスポート/インポートや実マイグレーションの導入を検討する
