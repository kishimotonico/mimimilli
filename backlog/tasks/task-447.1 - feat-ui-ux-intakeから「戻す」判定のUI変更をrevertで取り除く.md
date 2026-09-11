---
id: TASK-447.1
title: feat/ui-ux-intakeから「戻す」判定のUI変更をrevertで取り除く
status: To Do
assignee: []
created_date: '2026-09-11 00:51'
labels:
  - ui
  - ux
  - triage
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 469000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-447 の判定で「戻す」になった変更を、統合ブランチ feat/ui-ux-intake 上でタスク単位の revert コミットとして取り除く。順序は 438 → 429（背表紙のみ）→ 430 → 428.22 → 428.4（部分）→ 428.15（部分）。コミット対応は tmp/uiux-triage-2026-09-11/inventory.md、原因調査は tmp/uiux-triage-2026-09-11/flicker.md・gridsize.md。UI 変更は後から戻し直せるよう、1タスク1コミット（部分戻しも1コミット）を守る。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 438・430・428.22 がそれぞれ1つの revert コミットで取り除かれ、428.9 の resultsBanner 描画集約（430前提）と 428.14 の useLibraryQueries.ts 変更が壊れずビルドできる
- [ ] #2 429 は折り畳み帯の背表紙（AncestorStack と 63cb7fd/0eb2386/9106959、439 が触れた AncestorStack 部分）だけが1コミットで戻り、アドレスバーのパンくず中間省略（e851424/61c9d46/2d2636c）は残っている
- [ ] #3 428.4 は ID重複（identityConflicts）時のUIだけが master の表現へ1コミットで戻り、要対応タブ・通知ベルのUIと 0414a51/bf98af4 のサーバー機能は残っている。errors シナリオで ID重複の確認導線が404にならず、DataIntegrityWarningBanner が表示される（435 AC#4）
- [ ] #4 428.15 は不正URLの自動復帰（libraryUrlRecovery.ts、LibraryView の復帰処理、libraryInvalidUrlToastAtom と GlobalToast の該当経路）だけが1コミットで戻り、検索 Escape とパンくず改善は残っている。不正URLは404表示のまま
- [ ] #5 1440x900・fixture large で作品詳細を選択中のグリッドが master と同じ6列・タイル幅181.5pxになり、詳細表示時のちらつきが無いことを flicker.md / gridsize.md の手順で数値確認している
- [ ] #6 各 revert で削除・変更されたテストを revert ごとに一覧化してタスクメモに記録している
- [ ] #7 pnpm check && pnpm test と pnpm test:smoke が通る
<!-- AC:END -->
