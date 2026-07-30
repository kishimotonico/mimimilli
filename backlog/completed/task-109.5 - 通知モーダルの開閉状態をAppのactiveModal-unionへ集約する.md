---
id: TASK-109.5
title: 通知モーダルの開閉状態をAppのactiveModal unionへ集約する
status: Done
assignee: []
created_date: '2026-07-28 13:03'
updated_date: '2026-07-28 13:22'
labels: []
dependencies: []
parent_task_id: TASK-109
priority: high
ordinal: 128000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-109.3 で通知モーダル3種の開閉を dlsiteNotificationModalAtom へ移したが、これは親タスク TASK-109 が「採用しない案」として却下していた設計（モーダル開閉の atom 化）にあたる。Codex のセカンドオピニオンでも撤回が明確に優れていると判定された。

現状の問題:
- モーダル開閉状態が2箇所に分裂している。App のローカル state（SettingsModal / ScanModal）と atom（通知モーダル3種）
- 分裂の結果、作品へ遷移する際に両方を閉じる必要があり、DlsiteNotificationModals が onBeforeNavigateToWork という props でスキャンモーダルを閉じる責務を受け取っている。これは分散した状態を事後同期する継ぎ目
- 排他性が構造的に保証されず、二重表示があり得る形になっている

atom 化の当初の根拠は「App の useState だとコールバックが TopBar を経由する」だったが、TASK-109.3 で TopBar が notificationBell を ReactNode の element prop で受け取る形にしたため、App が NotificationBell を直接組み立てている。開閉コールバックは TopBar を経由せず App から直接渡せるので、この根拠は成立しない。

現時点でモーダルを開く箇所はすべて App の直接の子であり、深い leaf から開く需要は存在しない。

方針:
- App に activeModal のユニオン（null | settings | scan | rj-missing | fetch-failed | parse-failed）を置き、全モーダルの開閉を集約する。単一 union なので排他性が型で保証される
- dlsiteNotificationAtoms.ts を削除する
- DlsiteNotificationModals の onBeforeNavigateToWork を削除する。閉じる操作は activeModal を null にするだけになる
- 通知モーダルの開閉コールバックは App から NotificationBell へ直接渡す（TopBar は経由しない）
- 一覧データは TanStack Query のままで変更しない
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 App に activeModal のユニオンがあり、SettingsModal・ScanModal・通知モーダル3種の開閉が全てそこに集約されている
- [x] #2 dlsiteNotificationAtoms.ts が削除されている
- [x] #3 DlsiteNotificationModals から onBeforeNavigateToWork が削除されている
- [x] #4 TopBar に通知関連の props が復活していない（TASK-109.3 の成果を維持している）
- [x] #5 通知ベル・3つのモーダル・スキャンモーダルの表示と操作、一覧から作品を開く遷移が従来どおり動作する
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
App に ActiveModal ユニオン（null | settings | scan | rj-missing | fetch-failed | parse-failed）を置き、全モーダルの開閉を集約した。client/src/app/model/activeModal.ts に union、Extract による部分型 DlsiteNotificationModalKind、型ガード isDlsiteNotificationModal を定義。NotificationBell の props は部分型に絞ってあり、ベルから通知モーダル以外を開けない。

モーダル遷移が単一の代入になった:
- 設定→スキャン: setShowSettings(false)+setShowScanModal(true) → setActiveModal("scan")
- スキャン→RJ未検出: setShowScanModal(false)+openDlsiteNotificationModal(...) → setActiveModal("rj-missing")
- 作品へ遷移: onBeforeNavigateToWork 経由の同期 → onClose() のみ

dlsiteNotificationAtoms.ts を削除、DlsiteNotificationModals の onBeforeNavigateToWork を削除。TopBar は無変更で109.3の成果を維持。

検証:
- pnpm check 通過、pnpm test 通過（server 340 / client 322）
- ビジュアルテスト 6/6、スナップショット差分なし
- ブラウザ実機: モーダル排他性を dialog[open] の実測で確認（設定→スキャン→RJ未検出の連鎖で常に1、閉じると0）。スキャンモーダル経由でRJ未検出を開き一覧から作品を開いた際に dialog[open] が0で作品詳細が表示されることを確認（旧 onBeforeNavigateToWork の経路）。通知ベルの開閉3経路、3モーダルの開閉と一覧、設定モーダルの各項目も確認。コンソールエラーなし
- 実バックエンドでは通知件数が0のため、通知系の導線は agent-browser network route でAPIをモックして検証
<!-- SECTION:NOTES:END -->
