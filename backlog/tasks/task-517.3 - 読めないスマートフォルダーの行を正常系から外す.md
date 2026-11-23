---
id: TASK-517.3
title: 読めないスマートフォルダーの行を正常系から外す
status: To Do
assignee: []
created_date: '2026-11-23 12:49'
labels:
  - server
  - shared
  - client
dependencies: []
parent_task_id: TASK-517
priority: medium
ordinal: 626000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
保存は検証済み API だけが行うので、読み出しも保存と同じスキーマ1本で厳密に読む。読めない行は一覧の正常な状態として持ち回らず、行の ID と sqlite3 での直し方を示して失敗させる。BrokenSmartFolder・condition の nullable・kind:"broken"・BrokenFolderPane・reportedBrokenFolders をなくす。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SmartFolder の condition が nullable でなく、読み出し用と保存用のスキーマが1本になっている
- [ ] #2 DB に読めない行があるとき、サーバーは行の ID と直し方を含むエラーを返し、ログに出す
- [ ] #3 client に壊れた行専用の画面・型・分岐が残っていない
<!-- AC:END -->
