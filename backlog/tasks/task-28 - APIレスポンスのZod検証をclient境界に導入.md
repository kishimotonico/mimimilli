---
id: TASK-28
title: APIレスポンスのZod検証をclient境界に導入
status: To Do
assignee: []
created_date: '2026-07-10 10:39'
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
- [ ] #1 get/post等にレスポンススキーマ検証版が導入され、getWork・searchWorks・smart-folders系が検証付きになる
- [ ] #2 getWorkがPromise<Work>になり、null分岐の伝播が除去される
- [ ] #3 検証失敗は握りつぶさずエラー表示につながる
<!-- AC:END -->
