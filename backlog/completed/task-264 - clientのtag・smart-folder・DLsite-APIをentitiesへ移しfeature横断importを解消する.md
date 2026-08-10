---
id: TASK-264
title: clientのtag・smart-folder・DLsite APIをentitiesへ移しfeature横断importを解消する
status: Done
assignee: []
created_date: '2026-08-08 21:18'
updated_date: '2026-08-09 01:10'
labels: []
dependencies: []
priority: high
ordinal: 274000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出。ドメインAPIが features/library に居座り、他featureが横断importしている。
- タグprefix CRUD API + useTagPrefixes（features/library/api.ts:72-89）を settings/files がimport → entities/tag/ へ
- smart-folder API（features/library/api.ts:94-136）→ entities/smart-folder/ へ
- DLsiteタグ変換 dlsitePreview.ts（features/library/model/）→ 純粋なwork変換として entities/work/ へ
- Codexレビュー反映: dlsiteInvalidation.ts は複数entity（work・tag・smart-folder）のqueryをinvalidateするユースケース処理なので、entities/work へ移すと今度はentity間の横断依存になる。features/dlsite などユースケース層へ置く
- getFsAudioUrl（features/files/api.ts）を player がimport → entities/file-system/api.ts へ
- getAllTags（entities/work/api.ts:64-66）→ entities/tag/api.ts へ（TAG_QUERY_KEYSと同居）
本タスクの解消対象は上記列挙分に限定する（feature間import全般の機械的禁止はTASK-282のlint整備で担保）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 タグprefix API・useTagPrefixes が entities/tag に移り、settings/files が library をimportしていないこと
- [x] #2 smart-folder API が entities/smart-folder に移っていること
- [x] #3 getFsAudioUrl が entities/file-system に移り、player が files をimportしていないこと
- [x] #4 clientのcheck・変更範囲のテストが通ること
- [x] #5 DLsiteタグ変換の純粋ロジックが entities/work に、複数entityのinvalidationがユースケース層（features/dlsite等）に移り、dlsite/files から library へのimportが解消されていること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
dlsiteInvalidation は work・tag・smart-folder を横断invalidateするユースケース処理のため entities ではなく features/dlsite/model へ配置。移動はすべて実体の移動で、移動元への互換re-exportは残していない。queryKey・invalidate対象・URL組み立ては移動前と同一であることをレビュー担当が差分照合で確認済み。検証: pnpm check 成功、client 102ファイル/775テスト全パス。entities→features のレイヤ違反・entity間横断importともに0件。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
タグprefix API・useTagPrefixes を entities/tag、smart-folder API を entities/smart-folder、dlsitePreview を entities/work、getFsAudioUrl を entities/file-system、getAllTags を entities/tag へ移動。dlsiteInvalidation は features/dlsite/model へ。settings・files・player・dlsite から features/library への横断importを解消した。pnpm check と client 775 テストで検証。
<!-- SECTION:FINAL_SUMMARY:END -->
