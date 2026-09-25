---
id: TASK-469.1
title: root再設定のサーバー側ワークフロー（状態管理・検証・catalog再構築）
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-24 07:22'
updated_date: '2026-09-25 03:28'
labels:
  - settings
  - scan
  - server
dependencies: []
parent_task_id: TASK-469
priority: high
ordinal: 525000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
S1の1〜3（実行中の管理ジョブ終了、操作ロック、検証→catalog・候補構築）と、旧rootにのみ存在した作品の扱いをサーバー側に実装する。対象ファイルはserver/src/adapters/real/settingsScanMethods.ts中心。

再生の停止（ブラウザ側の状態）はクライアント側（S1.2）の責務とし、本タスクは実行中の管理ジョブ（scan/DLsite等）の終了と、再設定中のメディア配信・通常操作APIの拒否を扱う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 新しいADRでroot再設定の状態遷移(通常運用/再設定中/失敗)・操作ロックの範囲・失敗時の再試行契約を記録している
- [ ] #2 root変更開始時に、実行中の管理ジョブ(scan/DLsite等)を終了させる
- [ ] #3 再設定中はメディア配信・Library/Files/scan開始等の通常操作APIを拒否する状態を持つ
- [ ] #4 対象rootの検証に成功すると、そのrootに対応するcatalogと候補が構築される
- [ ] #5 途中で停止した場合、再設定が未完了であることをサーバー側の状態から判断できる
- [ ] #6 旧rootにのみ存在した作品はcatalog一覧から外れるが、user状態は保持されることがテストで確認されている
- [ ] #7 失敗時はエラーとともに再設定状態が維持され、再試行できることがテストで確認されており、pnpm check && pnpm test が通る
<!-- AC:END -->
