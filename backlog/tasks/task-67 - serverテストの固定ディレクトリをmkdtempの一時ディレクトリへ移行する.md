---
id: TASK-67
title: serverテストの固定ディレクトリをmkdtempの一時ディレクトリへ移行する
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 03:08'
updated_date: '2026-07-19 03:21'
labels: []
dependencies: []
modified_files:
  - server/tests/helpers/sampleLibrary.ts
  - server/tests/helpers/smoke.ts
  - server/tests/real/dlsite.test.ts
  - server/tests/real/fsBrowse.test.ts
  - server/tests/real/media.test.ts
  - server/tests/real/metaWriteback.test.ts
  - server/tests/real/scanner.test.ts
  - server/tests/real/thumbnail.test.ts
  - server/tests/real/thumbnailCache.test.ts
  - server/tests/real/thumbnailGc.test.ts
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー(2026-07-19)指摘22。server/tests/helpers/sampleLibrary.ts:42 がリポジトリ相対の固定パス（data/test-*）をrmSync→再生成しており、並列テスト・複数worktree・並行セッション（実際に運用中）で衝突する。

対応: mkdtempでテストごとの一時ディレクトリを作り、afterで破棄する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 server/tests が data/test-* 固定パスを使わず、テストごとの一時ディレクトリで動く
- [x] #2 テスト終了時に一時ディレクトリが破棄される
- [x] #3 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. data/test-*参照とテストのsetup/teardownを洗い出す
2. sampleLibrary helperにmkdtempベースの一時ディレクトリ生成・破棄を追加する
3. 各テストをテスト単位の一時ディレクトリとafter cleanupへ移行する
4. serverテストと全体チェックを実行する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
os.tmpdir()配下をmkdtempSyncでテストごとに確保し、各node:testのt.afterで再帰削除する構成へ統一した。data/test-*参照とテスト後のmimimilli一時ディレクトリ残存はいずれも0件。検証: pnpm check / pnpm test 成功。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
serverの固定テストディレクトリをテスト単位のmkdtempへ移行し、after cleanupを追加した。pnpm checkとpnpm testで検証済み。
<!-- SECTION:FINAL_SUMMARY:END -->
