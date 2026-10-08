---
id: TASK-476
title: 型の逃げと参照ゼロのexportを解消する
status: Done
assignee:
  - '@mimi2'
created_date: '2026-10-02 11:40'
updated_date: '2026-10-08 06:44'
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
- [x] #1 列挙した非nullアサーションとas キャストが型設計（型ガード・判別共用体・skipToken等）で置き換わっている
- [x] #2 WorkEditDialogとuseHoverGroupCoordinatorのeffectが依存を偽らずに書かれ、eslint-disableが無い
- [x] #3 pnpm check && pnpm test が通る
- [x] #4 本番コードとテストのどちらからも参照されないexport（WORK_EDIT_FIELDS など）が削除されている
- [x] #5 テストからだけ参照されるexport（getNormalizeTagBatchCacheStateForTests・tagFiltersFromSelected・coverFieldsFromCover など）は、振る舞いのテストへの置き換えかtest helperへの移設かを決めて整理し、代わりに何を保証するかが説明されている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-02構造点検（doc-6・doc-7）より: server/tests/metaCasRace.test.ts の withCasDelay は環境変数 MIMIMILLI_ATOMIC_WRITE_CAS_DELAY_MS を設定するが server/src に参照が無く、withCasDelay(0, ...) だけが呼ばれる死んだ仕組み。AC#2の範囲で一緒に削除する（doc-7 tool-6）。isStoredTagNormalizedの削除も点検で確認済み（doc-6 shared-8）。

2026-10-04 Codex(Astra)レビュー（tmp/structural-audit-2026-10-02/review-astra.md）を反映: 列挙の一部はテストから参照されている（tagStoredNormalize.test.ts・helpers/tag.ts・helpers/workTestUtils.ts・worksQueryContract.test.ts・coverLabel.test.ts）。「本番から未使用」と「参照ゼロ」を分けてACを直した。WorkEditDialogのeffectはTASK-492で状態管理を抽出するので、492の後に着手するか、抽出後の形を作り直さない範囲にとどめる。

AC#5 の補足（2026-10-08）: 削除したテストと代わりの保証。(1) isTagNormalized は本番参照ゼロのため関数ごと削除し、その単体テスト（tagPrefixes.test.ts）と「normalizeTag と一致」「Unicode 境界での isTagNormalized の判定」のアサーションも削除。Unicode 境界・空白・prefix の組み合わせでの受理/拒否は parseStoredNormalizedTags の corpus 全件テストと Unicode 境界テスト（「正規化されていません」）、null になる入力の「正規化できません」テストが引き続き縛る。(2) withNormalizeTagBatchCache のキャッシュ漏れテスト2本（正常終了後・例外後に active=false・size=0）は、状態を覗く getNormalizeTagBatchCacheStateForTests を本番から外したため削除し、別の形では縛らない。キャッシュは判定結果に影響しない純粋なメモ化で、漏れても失うのはメモリ面だけ（判定結果の一致・ネスト時に外側のキャッシュが生きること・例外がそのまま伝播することはテストで残る）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
AC#1 の残り4箇所を除き 9939fe4d で master へマージ。残りは TASK-491（feat/audit-client-jobs）が master に入った後に対応する。

残り4箇所（durationSec!・e.target のキャスト）も 61e4b7bb で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
