---
id: TASK-109.3
title: 通知件数の購読をNotificationBellへ降ろす
status: To Do
assignee: []
created_date: '2026-07-27 01:56'
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
- [ ] #1 App.tsx が通知件数フック（useRjCodeMissingWorks 等4種）を呼んでいない
- [ ] #2 TopBar から通知関連の props が消えている
- [ ] #3 通知ベルのバッジ件数・一覧の表示と、一覧から作品を開く動作が従来どおり
- [ ] #4 useDlsiteBulk と直近スキャン結果の所有権は App に残っている
<!-- AC:END -->
