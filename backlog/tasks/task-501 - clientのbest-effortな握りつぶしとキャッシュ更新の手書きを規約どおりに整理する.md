---
id: TASK-501
title: clientのbest-effortな握りつぶしとキャッシュ更新の手書きを規約どおりに整理する
status: Done
assignee:
  - '@mimi2'
created_date: '2026-10-02 11:49'
updated_date: '2026-10-08 06:44'
labels:
  - client
  - refactor
dependencies:
  - TASK-487
  - TASK-488
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
- [x] #1 実質的に不要な.catchが無い
- [x] #2 残った握りつぶしがすべてclient-error-handling.mdの一覧に載っている
- [x] #3 ADR-0015の本文に廃止済みのatomが現行として書かれていない
- [x] #4 Filesから既登録作品を扱ったときのキャッシュ更新がworkCacheUpdatesの関数を通る
- [x] #5 pnpm check && pnpm test が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-04 Codex(Astra)レビュー（tmp/structural-audit-2026-10-02/review-astra.md）を反映: ReconfigurationExitEffectの握りつぶしはTASK-488で移動するので、最終的な整理は488の後に行う。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
不要だった updateCachesAfterDlsiteBulkFetch の catch を削除し、残す握りつぶしを理由付きで client-error-handling.md に（古い記述も修正）、ADR-0015 を現行のストアとイベントの構成に、Files の登録後キャッシュ更新を updateCachesAfterRegistration に。 個別レビュー＋統合ブランチの横断レビュー、master への仮マージで pnpm check・test（server 951 / client 1339）・smoke 30 全通過、fixture でのブラウザ確認（再生・作品編集・スキャン・root 再設定）で崩れ・エラーなし。61e4b7bb で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
