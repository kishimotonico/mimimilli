---
id: TASK-511.10
title: スキャンとDLsite連携の現行仕様書を書き換える
status: To Do
assignee: []
created_date: '2026-11-19 00:25'
updated_date: '2026-11-19 00:42'
labels:
  - docs
dependencies:
  - TASK-511.1
  - TASK-511.2
  - TASK-511.3
  - TASK-511.4
  - TASK-511.5
  - TASK-511.6
  - TASK-511.7
  - TASK-511.8
  - TASK-511.9
  - TASK-511.11
  - TASK-511.12
documentation:
  - docs/adr/0033-dlsite-fetch-before-register.md
  - docs/adr/0034-scan-modal-restructure.md
parent_task_id: TASK-511
priority: medium
ordinal: 579000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0033・ADR-0034は決定の記録で、現行仕様書は実装が終わるまで書き換えていない。実装後に、追記ではなく書き換えで現在の状態にそろえる（AGENTS.md「ドキュメント運用」）。ADRは不変の記録なので書き換えない。

対象: docs/dlsite.md、docs/requirements-v4.md（§4.4 DLsiteからのタグ自動取得、§8.2 スキャンのトリガーと実行モデル ほか）、docs/ARCHITECTURE.md、docs/design-system.md、docs/HANDOFF.md、docs/client-error-handling.md。2026-11-19時点で旧仕様（まとめて取得・apply-missing・未設定項目の適用・通知ベル）に触れているものを rg で探して直す。用語の「行方不明」への統一（UI側）はTASK-511.7で済んでいる前提で、docs側もそろえる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docs/dlsite.md が登録前の明示取得・追加＝承認・作品詳細の差分確認の流れで書かれ、廃止した機能の記述が無い
- [ ] #2 docs/requirements-v4.md の§4.4・§8.2ほかスキャン結果とDLsiteの記述が現在の仕様と合っている
- [ ] #3 docs/ARCHITECTURE.md のスキャン・DLsiteのデータフローが現在の構造と合っている
- [ ] #4 docs配下（adr/を除く）で rg「まとめて取得|apply-missing|未設定項目|通知ベル|NotificationBell|ファイル欠損」をしても旧仕様の記述が出ない
- [ ] #5 pnpm check が通る
<!-- AC:END -->
