---
id: TASK-495
title: DLsite一括取得を作品ごとの取得→適用→進捗の流れに作り替える
status: To Do
assignee: []
created_date: '2026-10-02 11:48'
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
dlsiteBulk.ts の runDlsiteBulk は、先に fetchDlsiteBulkAttempts で全rjCodeを直列取得してから全件をapplyし、onProgress はapplyのループでしか呼ばない。リクエスト間隔は既定1秒なので、未取得が多いと取得中ずっと進捗が出ない。取得後に中断されると結果は0件のまま返り、取消時の result も dlsiteJobManager.ts で0固定になる。DlsiteOfflineError はジョブ全体をerror終端にする。HTMLキャッシュはディスクに残るので再実行すれば回復するが、表示と結果が実態と合わない。rjCode単位の重複排除（同じrjCodeは初出時の取得結果を使い回す）は保ちつつ、作品ごとに取得→適用→進捗通知を行う。詳細は doc-6 の jobs-1。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 一括取得中、作品1件の処理が終わるたびに進捗が通知される
- [ ] #2 取消・中断時の結果が、それまでに適用した件数を正しく返す
- [ ] #3 同じrjCodeを持つ作品が複数あってもDLsiteへの取得は1回だけ
- [ ] #4 取得結果を全件まとめて保持する構造が無い
- [ ] #5 進捗・取消・オフライン時の終端がテストで縛られている
- [ ] #6 pnpm check && pnpm test が通る
<!-- AC:END -->
