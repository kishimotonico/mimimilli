---
id: TASK-501
title: clientのbest-effortな握りつぶしとキャッシュ更新の手書きを規約どおりに整理する
status: To Do
assignee: []
created_date: '2026-10-02 11:49'
updated_date: '2026-10-02 11:50'
labels:
  - client
  - refactor
dependencies:
  - TASK-487
documentation:
  - backlog/docs/doc-7
  - docs/client-error-handling.md
priority: low
ordinal: 559000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
docs/client-error-handling.md の「完全に無視する箇所」は5件だが、実装には一覧外の握りつぶしがある: refreshScanCandidates(...).catch(() => {})（ScanRuntime・ScanModal・UnregisteredTab）、updateCachesAfterDlsiteBulkFetch(...).catch(() => {})（DlsiteBulkRuntime。invalidateQueries は既定でrejectしないので実質不要）、getDlsiteBulkStatus のbare catch、ReconfigurationExitEffect の握りつぶし。ADR-0015の本文は廃止済みの scanErrorAtom/dlsiteBulkErrorAtom を現行として書いている。また FilePreviewWorkActions の alreadyRegistered 分岐が FILE_SYSTEM と scan diagnostics を直接invalidateしており、workCacheUpdates の登録後更新と同じ集合を手書きで一部だけ持っている。不要なcatchは消し、残す握りつぶしは基準に照らして一覧に載せ、登録後のキャッシュ更新は workCacheUpdates の関数を使う。共通ヘルパーやlintによる機械検査は作らない。scan/DLsiteのジョブ追跡をストアへ移すタスクと同じファイルに触るので、着手順を合わせる。詳細は doc-7 の cli-arch-6・cli-arch-4。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 実質的に不要な.catchが無い
- [ ] #2 残った握りつぶしがすべてclient-error-handling.mdの一覧に載っている
- [ ] #3 ADR-0015の本文に廃止済みのatomが現行として書かれていない
- [ ] #4 Filesから既登録作品を扱ったときのキャッシュ更新がworkCacheUpdatesの関数を通る
- [ ] #5 pnpm check && pnpm test が通る
<!-- AC:END -->
