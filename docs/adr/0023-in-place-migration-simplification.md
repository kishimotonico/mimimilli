# ADR-0023: DBマイグレーションをin-place適用へ簡素化する

- ステータス: 承認
- 日付: 2026-08-20
- 関連: [ADR-0008](0008-persistence-topology-query-ownership-playback-ids.md)、[ADR-0017](0017-meta-source-projection-and-work-identity.md)、[ADR-0021](0021-custom-sqlite-migration-executor.md)、TASK-356、TASK-460

## 文脈

`pnpm dev:real` 起動不能の直接原因は、pre-migration バックアップ検証が「マイグレーション後のスキーマ」を旧スキーマのスナップショットに要求していた設計矛盾である。user migration 0005（`scan_candidate_exclusions` 追加）以降、既存DBを持つ環境だけが「必須テーブルがありません」でFATAL終了する。

加えて、catalog migration 0006/0007/0011 の SQL は `PRAGMA foreign_keys=OFF/ON` を含むが、executor が全体を `BEGIN` で包んでいたため、トランザクション内の `PRAGMA foreign_keys` は SQLite 仕様上 no-op となり、FK 有効のままテーブル再作成が走っていた。

Anki、Signal Desktop、Joplin、Zotero、beets、Navidrome 等の実装調査では、候補DB copy→swap 方式の前例はなく、「事前バックアップ＋in-place トランザクション適用＋失敗時 fail-fast」が一般的であった。

## 決定

### in-place 適用への一本化

- catalog / user とも、マイグレーションは本番DBファイルへ直接適用する
- 候補DBの作成・入れ替え（`databaseReplacement.ts`）は廃止する

### executor の原子性

- migration 1件ごとに「DDL・`__drizzle_migrations` への追記・`PRAGMA user_version` 更新」を同一トランザクションで原子的に適用する
- `PRAGMA foreign_keys=OFF/ON` はトランザクション外で適用する（SQLite 公式の 12-step 手順と同構造）
- `foreign_keys` を無効化した状態で DDL を適用した場合は `COMMIT` 前に `PRAGMA foreign_key_check` を実行し、違反があれば失敗させる
- 成功・失敗どちらの経路でも接続の `foreign_keys` 設定を ON へ戻す

### forward-only

- DB がアプリより新しい場合（`user_version` がアプリ版を超える、または ledger に journal にない新しいエントリがある）は、バックアップ作成も `user_version` 書換えもせず即エラーで起動失敗する
- catalog の `user_version` 不一致時の退避→再作成分岐は廃止する。ledger を正とする

### バックアップ

- マイグレーション前バックアップは `VACUUM INTO` で作成する
- 検証は独立接続での `PRAGMA integrity_check` のみとする（スキーマ固定リストによる検証は行わない）
- `VACUUM INTO` 失敗・検証 NG 時は出力ファイルを削除する
- バックアップ・検証は `user_version=0` かつテーブルゼロの新規DBに限りスキップする
- `purgeOldBackups` は連番付きファイル名（`user-…-pre-migration-1.sqlite` 等）も世代管理対象とし、タイムスタンプ＋連番を生成順として並べる（同一タイムスタンプでは連番が大きい方が新しい）
- マイグレーション失敗時は例外を投げて起動失敗とする。自動リストア・自動リセットは実装しない

### 接続の後始末

- `openVersionedDatabase` がマイグレーションやバックアップ検証で throw する経路では、開いた主DB接続を必ず `close` する（Windows のファイルロック残り防止）

### 手動リストア手順

server を完全停止したうえで、対象DBの本体・`-wal`・`-shm` を退避または削除し、`backup/` のスナップショットを配置してから起動する。

Linux（開発・WSL）:

```bash
# server停止後
DATA_ROOT=~/.local/share/mimimilli   # 実際の dataRoot に合わせる
mkdir -p /tmp/user-broken-backup
mv "$DATA_ROOT/db/user.sqlite"{,-wal,-shm} /tmp/user-broken-backup/ 2>/dev/null || true
cp "$DATA_ROOT/backup/user-YYYY-MM-DDTHH-MM-SS-mmm-pre-migration.sqlite" "$DATA_ROOT/db/user.sqlite"
# 起動
```

Windows:

```powershell
# server停止後
$dataRoot = "$env:LOCALAPPDATA\mimimilli"
New-Item -ItemType Directory -Force -Path "$env:TEMP\user-broken-backup" | Out-Null
Move-Item "$dataRoot\db\user.sqlite*" "$env:TEMP\user-broken-backup\" -ErrorAction SilentlyContinue
Copy-Item "$dataRoot\backup\user-YYYY-MM-DDTHH-MM-SS-mmm-pre-migration.sqlite" "$dataRoot\db\user.sqlite"
# 起動
```

catalog DB も同様に `catalog.sqlite` と `backup/catalog-…-pre-migration.sqlite` で行う。

### DLsite取得失敗表示の寿命

DLsiteの取得失敗（`not_found` / `error`）は `db/dlsite-cache.sqlite`（`dlsite_fetch_failures` 等、ADR-0008）に記録し、`failure_expires_at` のTTLで管理する（既定値は`server/src/adapters/real/dlsiteCache.ts`の`DEFAULT_DLSITE_CACHE_TTLS_MS`）。このTTLは再取得を抑止する期間だけを制御し、catalog投影（`work_dlsite.state_json`）に表示済みの失敗結果を消す契機にはしない。TTLが切れても、既存の投影表示は次の取得・再合成まで残る。

`catalog.sqlite` を本ADRの対象であるin-place適用のマイグレーションではなく、ファイルごと削除して再構築した場合（開発中の再作成、配布後に提供する再構築手順のいずれも）、DLsite失敗の投影は最後の取得結果の保持を保証しない。投影はmimimilli.jsonとキャッシュから再合成される値であり、キャッシュが既に期限切れ、または`dlsite-cache.sqlite`自体を失っていれば`none`に戻る。一方、`dlsite-cache.sqlite`はcatalogと物理的に別ファイルでありcatalog再構築の対象外のため、再構築時点でキャッシュが有効期限内であれば、再構築後の再scanで同じ失敗表示が再び得られる場合がある。これは禁止しない。

## 帰結

- 旧スキーマの pre-migration バックアップが検証で落ちる矛盾が解消され、既存DB環境でも起動できる
- migration 途中クラッシュ時は旧状態または各 migration 完了境界のいずれかの一貫状態に収束する
- FK を伴うテーブル再作成 migration が意図どおり動作する
- DB がアプリより新しい場合はデータを書き換えず fail-fast する
- 失敗時の復旧は手動リストアに委ねる。運用は単純化される一方、自動ロールバックは提供しない
- DLsite取得失敗の表示は一時的な観測であり、catalog再構築後の保持を保証しない。cacheのTTL（再取得の可否）と表示の保持は別の寿命として扱う
