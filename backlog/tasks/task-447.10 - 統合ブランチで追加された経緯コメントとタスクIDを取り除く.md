---
id: TASK-447.10
title: 統合ブランチで追加された経緯コメントとタスクIDを取り除く
status: Done
assignee: []
created_date: '2026-09-11 02:09'
updated_date: '2026-09-11 02:24'
labels:
  - triage
  - chore
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 478000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-447 の最終レビュー（統合ブランチ feat/ui-ux-intake 全体、master 1c64eda との差分）で、AGENTS.md の「コメントは最小限、経緯を書かない」とドキュメント運用「経緯はGit履歴・ADR・backlogに任せる」に反する記述が見つかった。対象は 1c64eda..feat/ui-ux-intake で追加された行だけで、master 以前からある記述は触らない。コードの挙動は変えない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 client/src・server/src・shared/src・client/src/styles で追加されたコメントから TASK-xxx / DRAFT-xx / 監査ID（files-A-18、SF-08 等）が除かれ、説明として必要な部分は残っている
- [x] #2 旧実装・レビュー指摘・実測時点に触れる経緯文（「以前は〜」「レビュー対応」「TASK-327で実測」「旧レイアウトの逆転」等）が、現在の設計理由だけの文に書き換えられるか削除されている
- [x] #3 client/tests・server/tests で追加された describe/it の名前とコメントから TASK-xxx 等のIDが除かれている（テストの中身・期待値は変わらない）
- [x] #4 docs/design-system.md・docs/dlsite.md・docs/HANDOFF.md で追加された見出しと本文からタスクIDが除かれている
- [x] #5 差分がコメント・テスト名・ドキュメントの文字列だけで、コードの挙動に関わる変更を含まない
- [x] #6 pnpm check && pnpm test が通る
<!-- AC:END -->
