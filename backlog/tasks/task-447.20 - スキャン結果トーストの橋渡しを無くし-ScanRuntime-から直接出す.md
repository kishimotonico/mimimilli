---
id: TASK-447.20
title: スキャン結果トーストの橋渡しを無くし ScanRuntime から直接出す
status: Done
assignee: []
created_date: '2026-09-11 08:05'
updated_date: '2026-09-11 09:03'
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
- [x] #1 ScanRuntime がスキャン結果トーストを useToast で直接出し、「要対応を見る」の onAction は App から props で渡された onOpenNeedsAttention を呼ぶ
- [x] #2 scanResultToastAtom、ScanResultToastBridge.tsx と関連テストが削除され、参照がない。GlobalToast に特別扱いが残っていない
- [x] #3 結果トーストの文面・variant・アクション（要対応があるときだけ「要対応を見る」、押すと閉じる、中止時の警告）が現状どおりで、それをテストで縛っている
- [x] #4 挙動は変わらず、既存テストの期待値を変えていない（テストの統合・名前変更だけ許容し、タスクメモに列挙）。pnpm check（レイヤー境界含む）・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
前提変更（アドバイザー判断）: ScanRuntime は Providers でマウントされ App から props を渡せないため、TASK-447.23 でモーダル状態を atom 化してから、ScanRuntime が useToast を直接呼び onAction でその atom を書く形にする。AC#1 の「App から props で渡された onOpenNeedsAttention」は「モーダル状態の atom への書き込み」と読み替える。

AC1の文言は447.23着手前確認で前提が変わった（modal-atom-design.md参照・統括承認済み）: onOpenNeedsAttentionのprops受け渡しではなく、ScanRuntimeがuseSetAtom(activeModalAtom)を直接持ち、onActionでsetActiveModal({kind:'scan',tab:'needsAttention'})を呼ぶ形。scanResultToastAtom削除・ScanResultToastBridge.tsx削除・GlobalToastに特別扱い無しは確認済み。テスト対応表: ScanResultToastBridge.test.tsxの4性質(要対応無し文面/要対応ありアクション+dismiss/中止時文言/一度きり消費)のうち、一度きり消費はuseScanJobのterminalHandledによる既存の重複排除で担保されるため対応するテストを新設せず(dlsite bulk attachの二重dispatchテストが同じ仕組みを既に検証)。残り3件はScanRuntimeを直接SSEで駆動するclient/tests/unit/runtimeEventSource.test.tsxのdescribe('ScanRuntime: 完了・中止トースト')へ移設（FakeEventSourceハーネスが既にそこにあるため、ScanRuntime.test.tsxへの複製を避けた）。既存2テストもscanResultToastAtom→toastRequestsAtom検証に書き換え。

実機確認(fixture new-work, http://447-20.mimi.localhost:1355): 通知ベルのID重複行→スキャンモーダルが要対応タブで開く／要対応タブの「一覧を見る」→DLsite取得失敗モーダルが開く／通知ベルのDLsite取得失敗行→同モーダル直接オープン／TopBarのスキャン・設定ボタン→各モーダルが開く、いずれもactiveModalAtom経由で正常動作を確認（スクショ: tmp/uiux-triage-2026-09-11/shots-intake/447.23-dlsite-modal.jpg, 447.23-scan-modal-needsattention.jpg, 447.23-settings-modal.jpg）。スキャン完了トースト（モーダルを閉じた状態での「スキャン完了」文言・「要対応を見る」アクション）はfixtureのスキャンステップが20ms×数回でCLI経由のクリック往復（各操作300〜800ms）より速く完了してしまい、モーダルを閉じる前に完了→サプレッションが働いてしまうため実機での目視確認ができなかった。この経路はclient/tests/unit/runtimeEventSource.test.tsxのdescribe('ScanRuntime: 完了・中止トースト')でFakeEventSourceにより決定的に検証済み（要対応無し文面・要対応ありアクション+dismiss・中止時文言の3テストが green）。
<!-- SECTION:NOTES:END -->
