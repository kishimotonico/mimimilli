---
id: DRAFT-54
title: 'user DBの保全: バックアップのVACUUM INTO化とforward-only migration化（配布前提条件）'
status: Draft
assignee: []
created_date: '2026-08-12 10:35'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DRAFT-27（archive済み）の残件。catalog/user 2DB分離・Drizzle migration正典化・migration前バックアップは実装済み（TASK-78/171、ADR-0008）。残るのは配布前提条件の2点。

- server/src/adapters/real/dbBackup.ts のバックアップがWAL DB本体+WAL+SHMの素朴なファイルコピー（transferDatabaseFiles）のままで、ADR-0008が要求するVACUUM INTO（またはSQLite Online Backup）方式と復元検証（スナップショットを別データルートで開いてintegrity_checkと現行schemaでの読み出し確認）が未実装
- server/src/adapters/real/db.ts のopenVersionedDatabaseは、schema version不一致時に退避して空DBを作り直す経路がuser DBにも効く。user DBはforward-only migrationのみとし、migration失敗時は旧DBを保持したまま起動を止める

着手トリガー: 配布（DRAFT-1）着手前。ただし2026-08-12設計レビュー（docs/application-architecture-review-2026-08-12.md 優先改善1）は「他の設計変更より先に行うべき」としており前倒し推奨。
<!-- SECTION:DESCRIPTION:END -->
