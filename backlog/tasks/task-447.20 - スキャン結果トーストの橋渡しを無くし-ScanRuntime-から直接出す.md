---
id: TASK-447.20
title: スキャン結果トーストの橋渡しを無くし ScanRuntime から直接出す
status: To Do
assignee: []
created_date: '2026-09-11 08:05'
updated_date: '2026-09-11 08:10'
labels:
  - refactor
  - triage
dependencies:
  - TASK-447.23
parent_task_id: TASK-447
priority: high
ordinal: 488000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計負債の返上 第3回（tmp/uiux-triage-2026-09-11/followup-3.md の2）。ScanRuntime がスキャン完了を scanResultToastAtom に書き、app/ui/ScanResultToastBridge.tsx がそれを読んで useToast の要求へ変換している。発行元が直接 useToast を呼ぶという一本化の目的に反するので、App が ScanRuntime に onOpenNeedsAttention を props で渡し、ScanRuntime が useToast を直接呼ぶ。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ScanRuntime がスキャン結果トーストを useToast で直接出し、「要対応を見る」の onAction は App から props で渡された onOpenNeedsAttention を呼ぶ
- [ ] #2 scanResultToastAtom、ScanResultToastBridge.tsx と関連テストが削除され、参照がない。GlobalToast に特別扱いが残っていない
- [ ] #3 結果トーストの文面・variant・アクション（要対応があるときだけ「要対応を見る」、押すと閉じる、中止時の警告）が現状どおりで、それをテストで縛っている
- [ ] #4 挙動は変わらず、既存テストの期待値を変えていない（テストの統合・名前変更だけ許容し、タスクメモに列挙）。pnpm check（レイヤー境界含む）・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
前提変更（アドバイザー判断）: ScanRuntime は Providers でマウントされ App から props を渡せないため、TASK-447.23 でモーダル状態を atom 化してから、ScanRuntime が useToast を直接呼び onAction でその atom を書く形にする。AC#1 の「App から props で渡された onOpenNeedsAttention」は「モーダル状態の atom への書き込み」と読み替える。
<!-- SECTION:NOTES:END -->
