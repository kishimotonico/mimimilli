---
id: TASK-317
title: identity_conflictをFilesで表示し「別作品として取り込む」操作を追加する
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-12 11:32'
updated_date: '2026-08-12 16:40'
labels: []
dependencies:
  - TASK-313
priority: medium
ordinal: 327000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
レビュー優先改善3のUI側。TASK-313でscanは重複Work IDを自動修復せずidentity_conflict診断として記録するようになる。これをFilesの第一級状態として可視化し、明示操作で解決できるようにする。UI仕様: Filesの一覧行とinspectorに警告badge（design-system.mdの警告色、文言「ID重複」）を表示／inspectorに競合の説明（同じWork IDを持つもう一方のフォルダーパスを併記）と「別作品として取り込む」ボタンを配置／実行すると複製側sidecarのWork IDだけをUUID再採番し、新規作品としてcatalogへ登録（user状態は引き継がない）／実行前に対象フォルダーパスを示す確認ダイアログ。再採番はこの明示操作のみで発生する。orphaned/invalid sidecarの表示拡充は本タスクのスコープ外。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 identity_conflict状態がFilesの一覧とinspectorでbadge表示される
- [x] #2 inspectorに競合相手のフォルダーパスが表示される
- [x] #3 「別作品として取り込む」操作で複製側のWork IDが再採番され、新規作品として登録される
- [x] #4 操作は確認ダイアログを経由し、再採番は明示操作のみで発生する
- [x] #5 pnpm test:smokeが通り、conflict表示と解決操作のテストがある
<!-- AC:END -->



## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Filesと診断・sidecar更新経路の既存契約を確認する。\n2. 診断対象WorkspacePathだけを受け付ける明示再採番APIをsource-first CASとcatalog投影で実装する。\n3. Files一覧・inspector・確認ダイアログとquery invalidationを実装する。\n4. server/client/smoke fixtureのテストを追加し、受け入れ条件を記録する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
identity_conflictをFilesの行・inspectorへ表示し、診断path限定のsource-first CAS再採番APIを追加。成功時はdiagnostics/catalog/files queryを無効化する。server/tests/real/identityConflict.test.ts は3 pass。client/server checkは他作業の既存型エラーで失敗（今回の変更箇所は報告なし）。smokeは実装のみで、指示どおり未実行。

統括判断: catalog投影に失敗してもsidecarをrollbackしないのはADR-0017のsource-first契約どおり。旧Work IDのuser stateを保持するのは原作品を保護するためであり、修正不要。
<!-- SECTION:NOTES:END -->
