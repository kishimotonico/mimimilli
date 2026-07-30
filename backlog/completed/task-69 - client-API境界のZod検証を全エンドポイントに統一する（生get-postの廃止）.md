---
id: TASK-69
title: client API境界のZod検証を全エンドポイントに統一する（生get/postの廃止）
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 03:09'
updated_date: '2026-07-19 03:34'
labels: []
dependencies: []
modified_files:
  - client/src/shared/api/http.ts
  - client/src/entities/work/api.ts
  - client/src/features/settings/api.ts
  - client/src/features/scan/api.ts
  - client/src/features/files/api.ts
  - client/src/features/library/api.ts
  - client/tests/unit/api.test.ts
  - shared/src/dlsite.ts
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー(2026-07-19)指摘8。client/src/shared/api/http.ts に検証なしのget/post/put/patchと検証ありのgetParsed系が並存し、library系はParsed、settings/scan/filesは非検証と、「Zod契約が正典」の保証がエンドポイントごとに不揃い。

対応: settings/scan/files等の残りのclient APIをすべてParsed系（shared契約のスキーマ）へ移行し、生のget<T>/post<T>を削除またはlintで禁止する。必要ならshared側に不足しているレスポンススキーマを追加する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 clientの全API呼び出しがZodスキーマによるレスポンス検証を通る
- [x] #2 検証なしのget<T>/post<T>系が削除されるか、新規使用が防止されている
- [x] #3 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. clientのHTTPヘルパー利用箇所とserverのレスポンス形を照合する
2. settings・scan・fsを既存sharedスキーマのParsed系へ移行し、DLsite一括開始レスポンスの不足スキーマをsharedに追加する
3. 204用の明示的なvoidヘルパーへ副作用APIを移行し、検証なしのget/post/put/patchを削除する
4. API境界の正常系・契約違反・voidレスポンスを既存テストの流儀で検証する
5. pnpm checkとpnpm testを実行し、受け入れ条件・完了サマリ・ステータスをBacklog CLIで更新する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
server/src/routes/ の実レスポンスと照合。settings・scan・fsは既存sharedスキーマを利用し、POST /dlsite/bulk用の開始レスポンススキーマのみ新設した。204エンドポイントはpostVoid/deleteVoidでステータスを検証する。server契約との不一致は見つからなかった。
検証: pnpm check 成功、pnpm test 成功（server 21件、client 243件）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
clientの全JSON API呼び出しをsharedのZodスキーマによるParsed系へ統一し、検証なしのget/post/put/patchを削除した。204レスポンスはvoid専用ヘルパーで扱い、DLsite一括開始レスポンスのsharedスキーマとAPI境界テストを追加した。pnpm checkとpnpm testで検証済み。
<!-- SECTION:FINAL_SUMMARY:END -->
