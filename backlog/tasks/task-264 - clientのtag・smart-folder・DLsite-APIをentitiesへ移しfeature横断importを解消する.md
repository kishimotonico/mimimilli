---
id: TASK-264
title: clientのtag・smart-folder・DLsite APIをentitiesへ移しfeature横断importを解消する
status: To Do
assignee: []
created_date: '2026-08-08 21:18'
labels: []
dependencies: []
priority: high
ordinal: 274000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出。ドメインAPIが features/library に居座り、他featureが横断importしている。
- タグprefix CRUD API + useTagPrefixes（features/library/api.ts:72-89）を settings/files がimport → entities/tag/ へ
- smart-folder API（features/library/api.ts:94-136）→ entities/smart-folder/ へ（現状queryKeysのみの薄いentityを本来の形にする）
- DLsiteタグ変換 dlsitePreview.ts・dlsiteInvalidation.ts（features/library/model/）を dlsite/files がimport → entities/work/ へ
- getFsAudioUrl（features/files/api.ts）を player がimport → entities/file-system/api.ts へ
- getAllTags（entities/work/api.ts:64-66）→ entities/tag/api.ts へ（TAG_QUERY_KEYSと同居）
完了後、feature間の直接importが残っていないことを確認する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 タグprefix API・useTagPrefixes が entities/tag に移り、settings/files が library をimportしていないこと
- [ ] #2 smart-folder API が entities/smart-folder に移っていること
- [ ] #3 DLsiteタグ変換・invalidation が entities/work に移り、dlsite/files が library をimportしていないこと
- [ ] #4 getFsAudioUrl が entities/file-system に移り、player が files をimportしていないこと
- [ ] #5 clientのcheck・変更範囲のテストが通ること
<!-- AC:END -->
