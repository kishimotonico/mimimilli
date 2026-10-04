---
id: TASK-476
title: 型の逃げと参照ゼロのexportを解消する
status: To Do
assignee: []
created_date: '2026-10-02 11:40'
updated_date: '2026-10-04 09:34'
labels:
  - client
  - server
  - shared
  - refactor
dependencies: []
priority: low
ordinal: 534000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-10-02の点検で見つかった型の逃げと死んだコード。server/shared: smartFolderWorks.ts:39,56,76 の resolveSmartFolderCandidateIds(...)!、scanRegister.ts:110・workRowMapping.ts:291 の durationSec!、coverDto.ts:28、shared/src/cover.ts:50、as unknown as ReadableStream 3箇所。client: app/App.tsx:176 playlist!.id、useLibraryQueries.ts:98 worksParams!、useLibraryQueries.ts:302 のJSON往復+as、coverLabel.ts:13 work.cover!、FilePreviewMedia.tsx:65-66、event.key as GridArrowKey 9箇所、e.target as HTMLElement（useGlobalShortcuts/usePopupDrag/TopBar）。参照ゼロのexport: shared/src/tagNormalize.ts の isStoredTagNormalized・getNormalizeTagBatchCacheStateForTests、shared/src/pseudoTag.ts tagFiltersFromSelected、shared/src/cover.ts coverFieldsFromCover、client workEditReconcile.ts WORK_EDIT_FIELDS、sourceMutation.ts isProjectionPending。WorkEditDialog.tsx:352-357とuseHoverGroupCoordinator.ts:270,282,299のeffectが依存を握りつぶしている。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 列挙した非nullアサーションとas キャストが型設計（型ガード・判別共用体・skipToken等）で置き換わっている
- [ ] #2 WorkEditDialogとuseHoverGroupCoordinatorのeffectが依存を偽らずに書かれ、eslint-disableが無い
- [ ] #3 pnpm check && pnpm test が通る
- [ ] #4 本番コードとテストのどちらからも参照されないexport（WORK_EDIT_FIELDS など）が削除されている
- [ ] #5 テストからだけ参照されるexport（getNormalizeTagBatchCacheStateForTests・tagFiltersFromSelected・coverFieldsFromCover など）は、振る舞いのテストへの置き換えかtest helperへの移設かを決めて整理し、代わりに何を保証するかが説明されている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-02構造点検（doc-6・doc-7）より: server/tests/metaCasRace.test.ts の withCasDelay は環境変数 MIMIMILLI_ATOMIC_WRITE_CAS_DELAY_MS を設定するが server/src に参照が無く、withCasDelay(0, ...) だけが呼ばれる死んだ仕組み。AC#2の範囲で一緒に削除する（doc-7 tool-6）。isStoredTagNormalizedの削除も点検で確認済み（doc-6 shared-8）。

2026-10-04 Codex(Astra)レビュー（tmp/structural-audit-2026-10-02/review-astra.md）を反映: 列挙の一部はテストから参照されている（tagStoredNormalize.test.ts・helpers/tag.ts・helpers/workTestUtils.ts・worksQueryContract.test.ts・coverLabel.test.ts）。「本番から未使用」と「参照ゼロ」を分けてACを直した。WorkEditDialogのeffectはTASK-492で状態管理を抽出するので、492の後に着手するか、抽出後の形を作り直さない範囲にとどめる。
<!-- SECTION:NOTES:END -->
