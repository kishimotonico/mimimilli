---
id: TASK-428.4
title: スキャンとDLsite取得の進行・完了・要対応状態を統一する
status: Done
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 19:32'
labels:
  - ui
  - ux
  - scan
  - dlsite
dependencies:
  - TASK-428.2
modified_files:
  - client/src/features/scan/ui/ScanRuntime.tsx
  - client/src/features/dlsite/ui/DlsiteBulkRuntime.tsx
  - client/src/app/ui/NotificationBell.tsx
parent_task_id: TASK-428
priority: high
ordinal: 431000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
scan-dlsite-A-01/A-04/A-05/A-06およびB重複。存在しないDLsiteジョブがactiveになり、通知ベルと要対応タブの件数定義も異なる。ジョブ実在確認、完了通知、問題単位の集計と解決導線を一つの状態モデルにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 DLsiteジョブがない場合は進捗・中止操作を表示せず、running/cancellingだけをactive表示する
- [x] #2 モーダル外で完了・中止を1回通知し、登録数・新規数・エラー数・欠損数を表示する
- [x] #3 通知ベルと要対応タブが同じ問題一覧と件数を使う
- [x] #4 ID重複はworkId単位1行で全パスと解決導線を示す
- [x] #5 pnpm test:smokeに新規失敗がない
- [x] #6 スキャン完了で新規作品があると一括取得ジョブが1件積まれ、無いときは積まれない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ID重複の解決は要対応タブ内で完結させる方式を採用した（reassignIdentityConflictを要対応タブから直接呼ぶ、Filesへの遷移は任意選択肢として残す）。DRAFT-70（要対応の遷移先をライブラリのエラービューへ一本化）とは矛盾しないと判断: DRAFT-70はRJコード未検出等『対象一覧を見るだけの行き先』の統一を主眼としており、ID重複は一覧を見るだけでは解決せず、フォルダー単位の再採番アクションが要る点で性質が異なる。DRAFT-70実施時にID重複もエラービュー遷移に寄せる決定になった場合は、要対応タブ内のreassign導線と使い分け（一覧確認はエラービュー、実際の解決操作は要対応タブ）を検討する。
<!-- SECTION:NOTES:END -->
