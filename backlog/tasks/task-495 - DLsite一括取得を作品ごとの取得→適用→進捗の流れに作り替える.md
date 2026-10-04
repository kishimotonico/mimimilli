---
id: TASK-495
title: DLsite一括取得を作品ごとの取得→結果集計・投影更新→進捗の流れに作り替える
status: To Do
assignee: []
created_date: '2026-10-02 11:48'
updated_date: '2026-10-04 09:34'
labels:
  - server
  - dlsite
dependencies: []
documentation:
  - backlog/docs/doc-6
priority: medium
ordinal: 553000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dlsiteBulk.ts の runDlsiteBulk は、先に fetchDlsiteBulkAttempts で全rjCodeを直列に取得してから、作品ごとに結果を集計して catalog の投影を更新し（applyDlsiteBulkWork・refreshWorkProjection）、onProgress はこの後段でしか呼ばない。リクエスト間隔は既定1秒なので、未取得が多いと取得中ずっと進捗が出ない。取得後に中断されると処理済み0件として返る。DlsiteOfflineError はジョブ全体をerror終端にする。HTMLキャッシュはディスクに残るので再実行すれば回復するが、進捗と結果が実態と合わない。rjCode単位で作品をまとめ、rjCodeごとに取得→結果集計・投影更新→進捗通知を行い、終わったrjCodeの取得結果は保持しない。ここでの「適用」はタイトル・タグ等を正本へ書く明示適用ではなく、DRAFT-74の差分確認後の適用は対象外。詳細は doc-6 の jobs-1。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 一括取得中、作品1件の処理が終わるたびに進捗が通知される
- [ ] #2 同じrjCodeを持つ作品が複数あってもDLsiteへの取得は1回だけ
- [ ] #3 進捗・取消・オフライン時の終端がテストで縛られている
- [ ] #4 pnpm check && pnpm test が通る
- [ ] #5 取消時の結果が、取消までに取得成功・取得失敗・パース失敗として処理した作品の件数を返す（通常の取消と例外による中断を区別してテストしている）
- [ ] #6 全件の取得完了を待ってから集計する二段階の構造が無い
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-04 Codex(Astra)レビュー（tmp/structural-audit-2026-10-02/review-astra.md）を反映: 当初の説明「取消時のresultも0固定」は誤りで、通常の取消はadapterが返したresultをそのまま送り、0固定は例外経路（dlsiteJobManager.ts:181付近）だけ。applyDlsiteBulkWorkは正本への書き込みではなく件数集計と投影更新なので、タイトルと説明を直した。同じrjCodeの取得を1回にしつつ全件保持もしないため、rjCodeごとに作品をまとめて処理する。
<!-- SECTION:NOTES:END -->
