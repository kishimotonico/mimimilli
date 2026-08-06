---
id: TASK-218
title: server realテストのテスト単位マイグレーション実行をやめ実行時間を削減する
status: To Do
assignee: []
created_date: '2026-08-06 17:26'
labels: []
dependencies: []
priority: high
ordinal: 228000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
実測（2026-08-07）で pnpm test のserver側18.0秒のうち tests/real/（35ファイル/288テスト）が15.7秒（87%）を占める。支配的コストはテスト内容ではなく、createTestRealAdapter がテスト1件ごとに実SQLiteマイグレーションを実行するインフラ構造（dlsite.test.ts だけで37回実行）。マイグレーション済みスキーマをプロセス内で使い回す方式（例: 一度マイグレーションしたテンプレートDBファイルを各テストへコピー、またはスキーマSQLのキャッシュ適用）へ変え、テストごとの分離は保ったまま実行時間を削減する。設計のクリーンさを最優先し、プロダクトコード側のマイグレーション実装は変えない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 テスト1件ごとのフルマイグレーション実行がなくなり、マイグレーションはプロセスあたり1回になっている
- [ ] #2 各テストは引き続き独立したDB状態で開始する（テスト間の状態漏れがない）
- [ ] #3 server全体のテスト実行時間が実測で大幅に短縮されている（目安: 18秒→8秒以下。到達できない場合は実測値と理由をnotesに記録）
- [ ] #4 bun test tests が全件通る
<!-- AC:END -->
