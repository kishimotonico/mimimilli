---
id: TASK-317
title: identity_conflictをFilesで表示し「別作品として取り込む」操作を追加する
status: To Do
assignee: []
created_date: '2026-08-12 11:32'
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
- [ ] #1 identity_conflict状態がFilesの一覧とinspectorでbadge表示される
- [ ] #2 inspectorに競合相手のフォルダーパスが表示される
- [ ] #3 「別作品として取り込む」操作で複製側のWork IDが再採番され、新規作品として登録される
- [ ] #4 操作は確認ダイアログを経由し、再採番は明示操作のみで発生する
- [ ] #5 pnpm test:smokeが通り、conflict表示と解決操作のテストがある
<!-- AC:END -->
