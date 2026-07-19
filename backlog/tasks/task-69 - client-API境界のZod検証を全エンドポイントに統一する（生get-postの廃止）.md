---
id: TASK-69
title: client API境界のZod検証を全エンドポイントに統一する（生get/postの廃止）
status: To Do
assignee: []
created_date: '2026-07-19 03:09'
labels: []
dependencies: []
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー(2026-07-19)指摘8。client/src/shared/api/http.ts に検証なしのget/post/put/patchと検証ありのgetParsed系が並存し、library系はParsed、settings/scan/filesは非検証と、「Zod契約が正典」の保証がエンドポイントごとに不揃い。

対応: settings/scan/files等の残りのclient APIをすべてParsed系（shared契約のスキーマ）へ移行し、生のget<T>/post<T>を削除またはlintで禁止する。必要ならshared側に不足しているレスポンススキーマを追加する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 clientの全API呼び出しがZodスキーマによるレスポンス検証を通る
- [ ] #2 検証なしのget<T>/post<T>系が削除されるか、新規使用が防止されている
- [ ] #3 pnpm check と pnpm test が通る
<!-- AC:END -->
