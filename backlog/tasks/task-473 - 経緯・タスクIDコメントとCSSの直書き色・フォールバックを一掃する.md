---
id: TASK-473
title: 経緯・タスクIDコメントとCSSの直書き色・フォールバックを一掃する
status: To Do
assignee: []
created_date: '2026-10-02 11:40'
labels:
  - cleanup
  - client
  - server
dependencies: []
priority: medium
ordinal: 531000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-10-02のリポジトリ点検で、AGENTS.mdの「コメントに経緯を書かない」方針違反がTASK-447.10後も残っていた。client/src・server/src・shared/srcの約33ファイルにTASK-ID入りや「従来どおり」「移行プラン ステップ3で実装」等の経緯コメントがある（例: shared/src/api.ts, shared/src/scan.ts, server/src/routes/works.ts, server/src/adapter/index.ts:4, client/src/shared/ui/useDialogModal.ts, ScanModal.tsx, library-c.css）。またclient/src/styles/global.cssに var(--paper-0, #f7f5f1) 型の直書きフォールバック、影色 oklch(20% 0.02 70 / α) が約26箇所、--r-coralのalpha版 oklch(72% 0.165 25 / α) が約7箇所、モーダル暗幕色が各所に直書きされている。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 client/src・server/src・shared/srcのコメントにTASK-ID（TASK-数字）が残っていない（rgで0件）
- [ ] #2 経緯・旧実装・移行計画に触れるコメントが残っていない
- [ ] #3 CSS変数参照に直書きの色フォールバックが無い
- [ ] #4 影色・coralのalpha版・モーダル暗幕色がtokens.cssのトークン経由で参照され、直書きのoklch値が残っていない
- [ ] #5 pnpm check && pnpm test && pnpm test:smoke が通る
<!-- AC:END -->
