# ADR-0021: migration実行をdrizzle migratorから自前のSQLite executorへ置き換える

- ステータス: 承認
- 日付: 2026-08-17
- 関連: [ADR-0008](0008-persistence-topology-query-ownership-playback-ids.md)、TASK-309、TASK-344

## 文脈

TASK-309で導入したuser DBのforward migrationは、候補DBへmigrationを適用してから現行DBと入れ替える。Windowsではこの入れ替えがファイルロックで失敗する回帰があった（TASK-344）。原因はdrizzle-ormのbun-sqlite migrator: `migrate()` はクエリごとに `client.prepare()` でstatementを生成するが、どの経路でも `finalize()` を呼ばずGCに任せる（drizzle-orm 0.45.2 の `bun-sqlite/session.js` および `sqlite-core/session.js` で確認）。`Database.close()` 後もネイティブハンドルが生存し得るため、Windowsでは候補DBのrename・削除が失敗する。

## 決定

migration実行を自前executor（`server/src/adapters/real/sqliteMigrationExecutor.ts`）へ一本化し、drizzle migratorへの依存を外す。

- migrationファイルの読み込みはdrizzleの公開API `readMigrationFiles`（`drizzle-orm/migrator`）へ委譲する。drizzle-kitが生成するjournal形式への結合はこのAPIが吸収する
- ledgerは `__drizzle_migrations` テーブルを継続使用する。DDL・pending判定（最新 `created_at` と `folderMillis` の比較）・INSERT列は drizzle 0.45.2 の `SQLiteSyncDialect.migrate()` と意味的に同一にし、既存DBとの連続性を保つ
- statementは都度 `finalize()` し、適用全体を1トランザクションで囲む。ROLLBACK失敗は一次例外のsuppressedへ保持する（drizzleは握りつぶす）

| 代替案                                 | 却下理由                                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| drizzle `migrate()` を維持しGC等で回避 | ハンドル解放がGCタイミング依存のままで、Windowsでの入れ替え成功を保証できない                        |
| 自前名のledgerテーブルへ再設計         | 既存DBの手動移行が必要になる一方で挙動上の利得がない。ledger再設計はTASK-344のスコープ外として分離済 |

## 帰結

- ledgerの書き手はこのexecutorのみになる。`__drizzle_migrations` の名前とスキーマは既存DBとの連続性のために継承した自前資産であり、以後drizzle内部実装への追従は不要
- pending判定は最新 `created_at` 1件との比較であり、中間migrationの欠落は検知しない。drizzle本体と同一挙動で、ledgerの書き手が単一の本システムでは欠落は外部改変でしか生じないため、検知機構は追加しない
- `migrationsTable` のカスタム名は非対応（`__drizzle_migrations` 固定）。呼び出し側はデフォルト名のみ使用している
- drizzle-orm更新時は `readMigrationFiles` の出力形式とledgerセマンティクスの一致を、`server/tests/real/dbBackup.test.ts` のexecutor系テストで確認する
