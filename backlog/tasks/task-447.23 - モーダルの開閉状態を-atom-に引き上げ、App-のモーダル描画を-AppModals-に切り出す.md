---
id: TASK-447.23
title: モーダルの開閉状態を atom に引き上げ、App のモーダル描画を AppModals に切り出す
status: Done
assignee: []
created_date: '2026-09-11 08:10'
updated_date: '2026-09-11 09:03'
labels:
  - refactor
  - triage
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 491000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計負債の返上 第3回（TASK-447.20 の前提確認で決定）。App.tsx が useState で持つ activeModal と scanModalInitialTab を1つの atom（判別可能な値、例: {kind:'scan', tab?}）に引き上げ、feature から開閉を命令できる形にする。App.tsx の Jotai read 禁止は維持し、モーダル描画は app/ui/AppModals に切り出してそこで読む。TopBar 経由の onOpenNotificationModal={setActiveModal} や DlsiteNotificationModals への setActiveModal の受け渡し等の prop drilling もこの atom に寄せる。atom の置き場所と型は実装前に設計案を統括経由でアドバイザーに見せる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 atom の置き場所と型の設計案（ActiveModal 型の entities/dlsite 依存の扱いを含む）がタスクメモにあり、アドバイザーの承認を得ている
- [x] #2 activeModal と scanModalInitialTab が1つの atom になり、App.tsx の useState から消えている。App.tsx は Jotai の read API を使わず、モーダル描画は app/ui/AppModals が atom を読んで行う
- [x] #3 モーダルを開く操作（TopBar の通知・設定・スキャン、DLsite 通知モーダル等）が atom への書き込みで行われ、setActiveModal 等のコールバックの props 受け渡しが無くなっている
- [x] #4 レイヤー規約（scripts/layer-boundary-rules.mjs、.oxlintrc.json）を満たし、pnpm check が通る
- [x] #5 挙動は変わらず、既存テストの期待値を変えていない（props から atom への置き換えに伴うテストの組み立て方の変更だけ許容し、タスクメモに列挙）。pnpm test・pnpm test:smoke が通る
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
テスト書き換え対応表: notificationBell.test.ts(props onOpenScanResult/onOpenNeedsAttention/onOpenNotificationModal→store.get(activeModalAtom)検証、renderBellのbellOverrides引数を削除), needsAttentionTab.test.tsx(onOpenNotificationModal propを削除、JotaiProvider+storeでラップ), scanModal.test.ts(onOpenNotificationModal: vi.fn()を2箇所削除), ScanResultToastBridge.test.tsx(onOpenScanNeedsAttention propを削除、store.get(activeModalAtom)で検証), topBarSearch/topBarUnregisteredBadge/topBarJobStatus.test.ts(onOpenScan/onSettingsのvi.fn()渡しを削除、TopBarPropsから両者が消えたため)。設計はtmp/uiux-triage-2026-09-11/modal-atom-design.mdに反映済み（アドバイザー承認）。
<!-- SECTION:NOTES:END -->
