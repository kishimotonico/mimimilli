# real アダプタの実装（移行プラン ステップ3 + DLsite 前倒し）

## 背景

`docs/architecture-v2-proposal.md` 移行プラン ステップ3。fixture アダプタと同じ `DataAdapter` 境界の中に、SQLite + 実ファイルシステムの実装を追加した。client/ ではモック作業が並行中のため、引き続き server/ と shared/ のみに閉じている。ステップ4予定だった DLsite 連携も自己完結だったため前倒しで移植した。

## 作業内容（server/src/adapters/real/）

- `schema.ts` / `db.ts` — Drizzle スキーマ（works / tags / work_tags / app_settings / search_presets / smart_folders / audio_probe_cache）。WAL モード、`user_version` によるスキーマバージョン検査（キャッシュ DB のため互換マイグレーションは持たない）
- `scanner.ts` — server-rust/src/scanner.rs の仕様を移植・改善:
  - mark_all_missing → メタ登録（ID 突合・移動追従、DB 固有情報保持）→ 自動生成 → missing 集計
  - UUID 重複の再採番＋メタファイル書き戻し（要件 v4 §3.1。Rust 版は未実装だった）
  - 再生時間を music-metadata で実プローブし `(size, mtime)` キーで SQLite にキャッシュ（Rust 版は start/end 指定時のみ計算で実質 0 固定だった）
  - 作品ルート判定を保守的に変更: 「親に画像がある / 親が単一サブフォルダーのラッパー」の場合のみ昇格（Rust 版はルート直下まで一律昇格でジャンルフォルダーを誤認するバグがあった）。ルート直下の音声（単一ファイル形式）は自動生成対象外
  - シンボリックリンクのディレクトリは辿らない（循環防止。Rust 版は follow_links）
- `meta.ts` — `.meta.json` の読み（Zod 検証）/ 書き（tmp + rename のアトミック更新）。部分書き戻しは生 JSON 編集で、スキーマ外のユーザー定義フィールドを保持する
- `workRepo.ts` — CRUD と行⇄ドメイン変換。検索・絞り込みは core/worksQuery（インメモリ）を使う（数千作品規模では十分。SQL 化の余地はアダプタ境界の内側に残る）
- `paths.ts` / `media` — realpath + 前方一致のパストラバーサル対策（Rust 版と同水準）、MIME マップ
- `fsBrowse.ts` / `fileTree.ts` — /api/fs と /api/works/:id/files の実体。作品対応付け（workId / workRelPath）
- `dlsite.ts` — fetch + cheerio へ移植。パースは pure 関数（HANDOFF.md のセレクタ準拠）、RJ コード検出、タグ prefix マージ（サークル/・cv/・genre/）、カバーダウンロード
- エントリポイント: `MIMIKAGO_ADAPTER` のデフォルトを real に変更（fixture は明示指定）。bind は 127.0.0.1 固定

## 修正したバグ

- rootFolder を相対パスで保存すると、DB の physicalPath と fs ブラウズの realpath の表現が食い違い workId 突合が失敗 → 設定保存時に realpath 正規化（updateSettings）

## 検証

- `pnpm check` / `pnpm test:server`: 50件全パス（既存30 + real アダプタ20）
- テストは実 WAV 生成ヘルパー（`tests/helpers/sampleLibrary.ts`）による結合テスト: スキャン（登録・自動生成・duration・エラー検出）、移動追従（bookmark 保持）、行方不明、UUID 重複再採番、メタ不正、メタ書き戻し（スキーマ外フィールド保持）、Range 206、トラバーサル遮断、fs 対応付け、DLsite パース・適用
- 手動スモーク: `node tests/helpers/smoke.ts`

## 備考

- Sonnet への委譲はセッション上限（リセット 8:50 JST）に当たったため、テストと DLsite 移植は Claude 本体が実装した（cheerio の依存追加までは完了していた）
- 残: SSE スキャン進捗（契約に `/api/scan/events` 予約済み）、client 合流（モック作業の完了待ち）、Rust server の削除（機能同等の確認後）
