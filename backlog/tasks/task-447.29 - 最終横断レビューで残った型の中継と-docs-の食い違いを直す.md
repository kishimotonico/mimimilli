---
id: TASK-447.29
title: 最終横断レビューで残った型の中継と docs の食い違いを直す
status: Done
assignee: []
created_date: '2026-09-11 12:36'
updated_date: '2026-09-11 12:40'
labels:
  - refactor
  - docs
  - triage
dependencies: []
parent_task_id: TASK-447
priority: medium
ordinal: 502000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
統合ブランチ全体の2回目の横断レビュー（fd07811）で残った3件。entities/dlsite/model/dlsiteNotificationModal.ts が shared の DlsiteNotificationModalKind を再 export する中継になっており、isDlsiteNotificationModal も3種のリテラルを重ねて書いている。docs/dlsite.md が computeMissingDiff の置き場所を adapter 側と書いている。docs/client-error-handling.md が削除済みの errorToastAtom を参照している。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 DlsiteNotificationModalKind の再 export が消え、利用側は shared/model/activeModalAtom から直接読む。3種の値は shared の1か所（例: as const の配列から型を導出）にだけあり、isDlsiteNotificationModal もそれを使う
- [x] #2 docs/dlsite.md の computeMissingDiff の置き場所が shared/src/dlsite.ts になっている（docs/HANDOFF.md の該当行も実態と食い違っていないか確認）
- [x] #3 docs/client-error-handling.md のエラー表示の説明が、useToast に一本化した現在の実装（error は variant=error の要求、所有者ごとの経路）と一致し、削除済みの atom 名が残っていない
- [x] #4 pnpm check・pnpm test が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
(1) shared/model/activeModalAtom.tsにDLSITE_NOTIFICATION_MODAL_KINDS（as const配列）を追加し、DlsiteNotificationModalKindはそこから導出。isDlsiteNotificationModalも同ファイルへ移設（用途がactiveModalAtomの判定そのもので、app/featuresの両方から参照されるため単一の置き場所として自然と判断）。entities/dlsite/model/dlsiteNotificationModal.tsは中継だけの空ファイルになるため削除し、AppModals.tsx・DlsiteNotificationModals.tsxはshared/model/activeModalAtomから直接import。
(2) docs/dlsite.md:46のcomputeMissingDiffの置き場所をserver/src/adapters/{real,fixture}/dlsiteMethods.tsからshared/src/dlsite.tsへ修正（実体はshared側、adapter側は呼び出すだけ）。docs/HANDOFF.md:105は場所を明記していない記述で実態と矛盾しないため変更なし。
(3) docs/client-error-handling.mdの「errorToastAtom」「dlsiteBulkErrorAtom」という存在しないatom名を削除。実装はScanRuntime/DlsiteBulkRuntimeが直接useToast().show()/error()を呼び、GlobalToastがtoastRequestsAtomを描画する一本化された経路であることに合わせて書き換え。scanErrorAtomはSetupScreenのインライン表示用に残っている点は維持。

結果: pnpm check・pnpm test（server 798・client 1106全pass）。コミット2つ（task/447.29）: d363579（コード）、e3469bb（docs）。
<!-- SECTION:NOTES:END -->
