---
id: TASK-109.3
title: 通知件数の購読をNotificationBellへ降ろす
status: Done
assignee: []
created_date: '2026-07-27 01:56'
updated_date: '2026-07-28 11:49'
labels: []
dependencies: []
parent_task_id: TASK-109
priority: medium
ordinal: 116000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DLsite関連の通知件数フックを App でまとめて呼び、TopBar 経由で NotificationBell へ13 props 渡している構造をやめる。

現状:
- App.tsx:113-116 が useRjCodeMissingWorks / useDlsiteFetchFailedWorks / useDlsiteParseFailedWorks / useDlsiteUnlinkedCount を呼ぶ
- 件数フックのうち useRjCodeMissingWorks 等は件数（summary query）だけでなく一覧の useInfiniteQuery まで購読している。一覧はモーダル側でも同じフックを呼んでいるので、ベルに必要なのは件数だけ

方針:
- ベルには GET のサマリー（getDlsiteNotificationSummary）の単一 query だけを持たせ、NotificationBell が自分で購読する
- 一覧の購読はモーダル側（RjCodeMissingModal / DlsiteFetchFailedModal / DlsiteParseFailedModal）に残す
- useDlsiteBulk と直近スキャン結果は SettingsModal・TopBarの進捗表示・Toast・ScanModal・スキャン完了後の attach でも使うため、NotificationBell へ所有権を移さない（App が持ったままでよい）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 App.tsx が通知件数フック（useRjCodeMissingWorks 等4種）を呼んでいない
- [x] #2 TopBar から通知関連の props が消えている
- [x] #3 通知ベルのバッジ件数・一覧の表示と、一覧から作品を開く動作が従来どおり
- [x] #4 useDlsiteBulk と直近スキャン結果の所有権は App に残っている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. useDlsiteNotificationSummary() を新設し、summary query 1本から全カウント（rjCodeMissing / fetchFailed / parseError + alert / unlinked）を返す。NotificationBell がこれを自分で購読する
2. 一覧の useInfiniteQuery を持つ既存フック（useRjCodeMissingWorks 等）はモーダル側の購読としてそのまま残す
3. 3つの通知モーダルの開閉を Jotai atom（dlsiteNotificationModalAtom）へ移し、<DlsiteNotificationModals /> が atom とモーダル・作品を開く遷移を所有する。App の useState 3つと handleOpenWorkFromNotification を削除
4. TopBar は notificationBell を ReactNode の element prop で受け取る（AppShell の topBar/leftNav と同じ合成パターン）。これで TopBar から通知関連 props が全て消える
5. useDlsiteBulk と直近スキャン結果の所有権は App に残す（SettingsModal・Toast・ScanModal・スキャン完了後の attach で使うため）。App が NotificationBell 要素を組み立てて TopBar へ渡す
6. 退行防止テスト: App が通知件数フックを呼ばないこと／ベルのバッジ件数が summary から出ることを検証
7. pnpm check / pnpm test / ビジュアルテスト / agent-browser で確認
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
件数は useDlsiteNotificationSummary（summary query 1本）を NotificationBell が自前で購読する形にした。一覧の useInfiniteQuery はモーダル側の購読として残している。

通知モーダルの開閉は dlsiteNotificationModalAtom へ移し、DlsiteNotificationModals が3モーダルと「一覧から作品を開く」遷移を所有する。スキャンモーダルの所有権は App に残るため、onBeforeNavigateToWork で App が setShowScanModal(false) を行う（atom への写し取りによる二重管理は避けた）。

TopBar は notificationBell を ReactNode の element prop で受け取る形にし、通知関連 props を全廃した。AppShell の topBar/leftNav と同じ合成パターン。useDlsiteBulk と直近スキャン結果の所有権は App に残したまま、App がベル要素を組み立てて渡す。

検証:
- pnpm check 通過、pnpm test 通過（server 340 / client 322、テスト3件追加）
- ビジュアルテスト 6/6、スナップショット差分なし
- 退行防止テストの意図的失敗確認で、当初のテストが旧実装でも通る検出力不足を発見し修正（App相当がフックを呼んでも戻り値を使わないと TanStack Query の tracked 挙動で再描画が起きないため）
- 再描画実測: 通知 summary の invalidate / setQueryData で App 0回・NotificationBell 2回（StrictMode二重）。無関係な settings refetch では両方0回
- ブラウザ実機: バッジ件数、パネル開閉3経路、DLsite未連携行、直近スキャン結果行、3モーダルの開閉と一覧、一覧から作品を開く遷移、スキャンモーダル→RJ未検出導線→作品を開いた際に両モーダルが閉じること（dialog[open] 0個）を確認。コンソールエラーなし

未確認: DLsite一括取得の中止ボタン。fixture の runDlsiteBulk が同期完了するため中止ボタンの描画前にジョブが終わる。中止経路は本タスクで変更していない
<!-- SECTION:NOTES:END -->
