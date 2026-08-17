---
id: TASK-350
title: dbBackupテストのrollbackファイル特定を決定的にする
status: To Do
assignee: []
created_date: '2026-08-17 17:03'
labels: []
dependencies: []
ordinal: 360000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server/tests/real/dbBackup.test.ts の「候補DBの復元失敗時はinstall失敗を一次例外として保持し、restore失敗はsuppressedへ積む」がフレーキー（体感2〜3回に1回失敗）。統合ブランチ feat/incident-20260817 のベース c08df4b でも再現し、TASK-348/349の変更とは無関係。

原因: 288行目の readdirSync(dirname(dbPath)).find((name) => name.includes('.rollback-')) が、rollback対象の複数ファイル（本体と -wal）から readdir の列挙順に依存して1件を拾う。-wal を拾うと 290行目の readFileSync が 'old-wal' を返し、'old' との比較で落ちる。

AssertionError: Expected values to be strictly equal: 'old-wal' !== 'old' (dbBackup.test.ts:290)

プロダクトコードの欠陥ではなくテストの書き方の問題。rollbackファイルの特定を決定的にする（-wal / -shm を除外する、または期待するファイル名を明示して比較する）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 server/tests/real/dbBackup.test.ts の当該テストが、rollbackファイルの特定を列挙順に依存せず決定的に行う
- [ ] #2 bun test tests/real/dbBackup.test.ts を10回連続実行して全て成功する
<!-- AC:END -->
