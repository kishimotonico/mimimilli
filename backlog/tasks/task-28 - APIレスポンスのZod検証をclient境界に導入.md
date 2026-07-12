---
id: TASK-28
title: APIレスポンスのZod検証をclient境界に導入
status: Done
assignee:
  - '@sonnet'
created_date: '2026-07-10 10:39'
updated_date: '2026-07-12 00:08'
labels:
  - frontend
dependencies: []
priority: medium
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計調査（2026-07-10）で判明: clientのget<T>等は型キャストのみで、worksPageSchema/workSchema等がレスポンス境界で検証されていない。またGET /works/:idは404だがclientのgetWorkはPromise<Work | null>で契約にないnull分岐が伝播。スキーマを渡せるgetParsed(schema, path)相当を導入し、getWork/searchWorks/スマートフォルダーから適用。getWorkはPromise<Work>へ。fixture/DB変換の隠れた不整合が表面化する可能性があるため、テストで受け止める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 get/post等にレスポンススキーマ検証版が導入され、getWork・searchWorks・smart-folders系が検証付きになる
- [x] #2 getWorkがPromise<Work>になり、null分岐の伝播が除去される
- [x] #3 検証失敗は握りつぶさずエラー表示につながる
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnet実装、Fableレビュー・検証。getParsed系導入、getWork/searchWorks/smart-folders/tag-prefixes/DLsite系まで適用。getWorkはPromise<Work>化しnull分岐を除去（App.tsxの死んだ分岐2箇所も削除）。表面化した不整合: listWorkFilesが同型のnull誤り（未使用関数、同時修正）。shared追加は一覧ラッパースキーマのみで契約変更なし。check・client 148件・server 135件全パス。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
client API境界にZodレスポンス検証を導入。検証失敗はエンドポイント・フィールド付きのエラーで伝播。
<!-- SECTION:FINAL_SUMMARY:END -->
