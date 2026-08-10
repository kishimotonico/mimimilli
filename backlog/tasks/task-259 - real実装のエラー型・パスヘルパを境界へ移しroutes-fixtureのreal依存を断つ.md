---
id: TASK-259
title: real実装のエラー型・パスヘルパを境界へ移しroutes/fixtureのreal依存を断つ
status: Done
assignee: []
created_date: '2026-08-08 21:16'
updated_date: '2026-08-09 00:55'
labels: []
dependencies: []
priority: high
ordinal: 269000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出したレイヤ境界違反の解消。
- server/src/routes/works.ts:13 と fixture が adapters/real/workRegister.ts の WorkRegisterError に依存
- server/src/routes/dlsite.ts:21 が real実装の DlsiteOfflineError に依存
- server/src/adapters/fixture/index.ts:89-90 が ../real/paths.ts の isPathWithin に依存
- server/src/scanJobManager.ts:11 が routes/dlsiteProgress.ts をimport（アプリ層→HTTP層の逆依存）
- server/src/lib/startupLog.ts:1 が real/dataRoot.ts の DataPaths 型に依存
エラー型は adapter境界（adapter.ts付近）へ、isPathWithin は lib/ へ、dlsiteProgress はルート非依存のモジュールへ移動する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 routes/ と adapters/fixture/ から adapters/real/ へのimportが消えていること
- [x] #2 scanJobManager.ts が routes/ をimportしていないこと
- [x] #3 lib/ が adapters/real/ の型に依存していないこと
- [x] #4 変更範囲のserverテストが通ること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
abortToken/エラー型/パスヘルパの移動はシンボル移動のみでロジック無変更。dlsiteProgress.ts→dlsiteJobQueue.ts はSSE購読・配信ロジック無変更。likeDescendantsPrefix は PathOperations ではなく pathSep を受け取る形へ簡素化。検証: pnpm check 成功、server 525 pass / 0 fail。副作用レビュー指摘なし。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
WorkRegisterError・DlsiteOfflineError を adapter.ts へ、isPathWithin を lib/path.ts へ、DataPaths を lib/dataPaths.ts へ移し、routes/fixture から adapters/real への import を排除。routes/dlsiteProgress.ts を dlsiteJobQueue.ts へ移して scanJobManager のアプリ層→HTTP層の逆依存を解消。pnpm check と server 525 テストで検証。
<!-- SECTION:FINAL_SUMMARY:END -->
