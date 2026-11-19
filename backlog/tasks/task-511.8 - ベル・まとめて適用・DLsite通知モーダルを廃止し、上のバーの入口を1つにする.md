---
id: TASK-511.8
title: ベル・まとめて適用・DLsite通知を廃止し、上のバーの入口を1つにする
status: To Do
assignee: []
created_date: '2026-11-19 00:25'
updated_date: '2026-11-19 00:51'
labels:
  - scan
  - dlsite
  - ui
dependencies:
  - TASK-511.1
  - TASK-511.6
  - TASK-511.7
  - TASK-511.12
references:
  - 'https://claude.ai/artifact/GbuEuRQyKeD9xN4CM3Fv1k'
documentation:
  - docs/adr/0033-dlsite-fetch-before-register.md
  - docs/adr/0034-scan-modal-restructure.md
parent_task_id: TASK-511
priority: high
ordinal: 577000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0033の「廃止するもの」のうちTASK-511.1で消さなかった残りと、ADR-0034の「入口とスキャン操作」の上のバーの入口を実装する。置き換え先（未登録タブ・要対応タブ）ができてから消す。全件取得の経路（DlsiteBulkRuntime・dlsiteBulkStore・ベルと設定の「まとめて取得」）はTASK-511.1で消し済みの前提。

消すもの（2026-11-19に rg で確認。着手時に下の rg で再確認する）:
- ベル: client/src/app/ui/NotificationBell.tsx とその組み込み（client/src/app/App.tsx ほか）。
- DLsite通知: 通知モーダル（client/src/features/dlsite/ui/RjCodeMissingModal.tsx・DlsiteFetchFailedModal.tsx・DlsiteParseFailedModal.tsx・DlsiteNotificationModals.tsx）、その一覧モデル（client/src/features/dlsite/model/dlsiteMissingRjCode.ts・dlsiteFetchFailed.ts・dlsiteParseFailed.ts・useDlsiteNotificationList.ts）、件数（client/src/entities/dlsite/model/dlsiteNotificationSummaryQueryOptions.ts・useDlsiteNotificationSummary.ts）、activeModal の種類（client/src/shared/model/activeModalAtom.ts、client/src/app/ui/AppModals.tsx）、クエリキー dlsiteNotifications（client/src/entities/work/queryKeys.ts・model/workCacheUpdates.ts・model/workMutations.ts）、API（client/src/entities/work/api.ts、server/src/routes/dlsite.ts の GET /dlsite/notifications・/dlsite/notifications/:kind、server/src/core/dlsiteNotifications.ts、server/src/adapter/work.ts・dlsite.ts、server/src/adapters/real/workMethods.ts・workQueryRepository.ts・workQuerySql.ts、server/src/adapters/fixture/works.ts、shared/src/api.ts・dlsite.ts の通知スキーマ）。
- まとめて適用: POST /dlsite/apply-missing/preview・/dlsite/apply-missing（server/src/routes/dlsite.ts、server/src/adapters/real/dlsiteMethods.ts・fixture/dlsiteMethods.ts、shared/src/dlsite.ts）、client/src/features/dlsite/ui/DlsiteBulkApplyDialog.tsx・DlsiteBulkApplyRuntime.tsx、client/src/entities/dlsite/useDlsiteBulkApplyActions.ts・model/bulkAtoms.ts の適用中フラグ、client/src/features/dlsite/model/formatDlsiteBulkApplyMissingResult.ts・formatDlsiteApplyMissingPreviewItem.ts、設定画面（client/src/features/settings/ui/SettingsModal.tsx）のDLsite節の残り。
- テスト: 上を参照する unit・server・smoke のテスト（例 client/tests/unit/notificationBell.test.ts・DlsiteBulkApplyDialog.test.tsx・formatDlsiteBulkApplyMissingResult.test.ts、server/tests/dlsiteApplyMissing*.test.ts・dlsiteNotifications.test.ts、client/tests/smoke/dlsiteBulkApply.smoke.spec.ts、client/tests/helpers/appShellApi.ts・builders.ts）。削除で期待値を緩めず、削除するか新しい仕様の期待値で書き直す。

上のバーの入口: 「スキャン」1つ。件数は出さない。スキャン中と、起点がまとめてのコードが取得中・待機中のあいだは進捗の輪（起点はproduct codeごと、TASK-511.1）。前回開いてから新しい候補か要対応が出たときだけ点を付け、開けば消える。「前回開いたとき」はクライアント（ブラウザ）に記憶する。現行の TopBar（client/src/app/ui/TopBar.tsx）のスキャン表示を置き換える。

ADR-0028 の必須更新表の「DLsite 未設定項目の一括適用」行と通知キーは、このタスクで実装から消える（ADR-0033）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 rg「NotificationBell|RjCodeMissingModal|DlsiteFetchFailedModal|DlsiteParseFailedModal|DlsiteNotificationModals|dlsiteNotifications|dlsite/notifications|DlsiteNotification」が client/・server/・shared/ で0件
- [ ] #2 rg「apply-missing|applyMissing|ApplyMissing|DlsiteBulkApply|dlsiteBulkApply|useDlsiteBulkApplyActions」が client/・server/・shared/ で0件
- [ ] #3 設定画面にDLsite節が無い
- [ ] #4 上のバーのスキャン関連の入口が1つで件数を出さず、スキャン中とまとめての取得中は進捗の輪、前回開いてから新しい候補か要対応が出たときだけ点が付き、開くと消える（単発の取得では輪が出ない）
- [ ] #5 削除した機能を参照していたunit・server・smokeテストが、期待値を緩めずに削除または新しい仕様で書き直されている
- [ ] #6 pnpm test:smoke を含めて pnpm check・pnpm test が通る
<!-- AC:END -->
