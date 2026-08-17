---
id: TASK-345
title: Windows並列realテストのtemp・DB削除EBUSYを解消する
status: In Progress
assignee: []
created_date: '2026-08-14 18:33'
updated_date: '2026-08-17 19:06'
labels:
  - bug
  - server
  - test
  - windows
dependencies: []
references:
  - TASK-344
priority: medium
ordinal: 355000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-344の最終pnpm-testで、多数のreal-testsがteardown時のtempディレクトリまたはDB削除にWindows-EBUSYで失敗した。TASK-341が扱うDLsite系2テストのSQLITE_BUSY・タイムアウトとは別に、未解放のDB・ファイルハンドルとcleanup順序を特定し、Windows並列実行でも決定的に削除できるようにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 EBUSYの最有力原因の機構・根拠と、実測で棄却した仮説がタスクnotesに記録されている
- [x] #2 テストのDB・ファイルハンドルは、個々のテストでの登録順に依存せず、tempディレクトリ削除より前に必ず解放される構造になっている
- [ ] #3 次回Windowsドッグフーディングで、並列real-testsのtemp・DB削除にEBUSYが再発しないことを確認する（実機確認待ち）
- [x] #4 server/tests/real 配下（TASK-341の既知フレーキー tests/real/dlsite.test.ts を除く）をLinuxで10回連続実行して全て成功する
- [x] #5 cleanupはcloserが例外を投げても残りのcloserとディレクトリ削除を必ず実行し、最初の例外を投げて以降をsuppressedへ積む
<!-- AC:END -->





## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## AC#1 原因調査（Linux観測）

### 最有力原因（Windows実機未確認の仮説を含む）
ADR-0021と同機構。drizzle-orm bun-sqliteセッションはクエリごとに `client.prepare()` し `finalize()` しない。`Database.close()` 後もネイティブstatementハンドルがGCまで生存し得る。加えて、real-testsでは `openDb` / `createTestRealAdapter` / 生の `Database` を開いたまま `directory.cleanup()`（`rmSync`）に入る経路が多数あった。

**静的列挙（移行前）**
- `makeTestDirectory` 使用テスト（dbBackup除く）で `t.after(() => *.close())` が無いファイルが多数（例: workUnregister 13テスト中 adapter.close 未登録、workRegister setup 関数群、fsAudio、trackDuration、thumbnailGc 等）
- drizzleクエリビルダ直呼び: workRepoPersistence, listSummaries, resume, dataIntegrityIsolation, workUnregister, scanner.test（audioProbeCache insert）, catalogProbeCacheMigration（`migrate(drizzle(...))`）
- `server/tests/helpers/sampleLibrary.ts` の `makeTestDirectory` は `rmSync` のみでリソース解放を知らない

**Linux観測**
- `openDb({kind:files})` + drizzle insert 後に `db.close()` せず `directory.cleanup()` しても Linux では `catalog.sqlite` は削除される（unlink可能）。Windowsでは同一状態でEBUSYになり得る（実機未確認）
- 移行後 `server/tests/helpers/sampleLibrary.test.ts` で `own` → `cleanup` の順序を検証。`scope.cleanup()` を外すと `closed=true` アサーションが落ちる（負の検証済み・復元済み）

### 棄却済み仮説
1. **afterフック登録順**: Bun `node:test` は LIFO。`t.after(directory.cleanup)` 先登録 + `t.after(() => db.close())` 後登録は実際 close→cleanup。統括実測済み。
2. **`db.close(true)` によるleak検出**: `db.query()` のstatement残存でも throw しない。Linuxゲートに使えない。統括実測済み。

## AC#2 構造対応
- `makeTestScope` / `makeTestDirectory.own` / `ownFn` を追加。`cleanup()` が登録逆順で close してから `rmSync`
- `makeSampleLibrary` も `own` を委譲
- real-tests（dbBackup除く）を `directory.own(...)` へ移行。個別 `t.after(() => close())` は削除（52箇所→`own` 164箇所）
- メモリDBのみのテストは `makeTestScope` + `scope.own(openDb(...))`

## AC#3 検証（Linux 10回連続 `cd server && bun test tests/real`）
1:369pass 2:144pass/33fail(TASK-341) 3:369 4:369 5:369 6:144/33fail(TASK-341) 7:369 8:144/33fail(TASK-341) 9:369 10:369
失敗時は `dlsite.test.ts`「同一RJコードは…HTTPを1回に集約する」の SQLITE_BUSY のみが先に落ち、177テストで打ち切り（32 errors）。TASK-341既知フレーキー。本タスク起因の失敗は観測せず。
`pnpm check` 成功。

統括による二分検証: AC#3（旧）の10回連続全成功はTASK-341の既知フレーキーにより達成不能。ベース（b440624、345未適用）で10回中5回、345適用後で10回中6回、いずれも tests/real/dlsite.test.ts の「同一RJコードは…HTTPを1回に集約する」SQLITE_BUSY で同一の落ち方（144 pass / 33 fail、以降打ち切り）。発生率・シグネチャとも同等で、345が誘発したものではないと判断した。ACを『dlsite.test.ts を除く10回連続全成功』へ修正し、除外条件で10回連続 319 pass / 0 fail を実測。dlsite.test.ts の解消はTASK-341に委ねる。
<!-- SECTION:NOTES:END -->
