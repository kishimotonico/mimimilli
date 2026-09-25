---
id: TASK-471
title: 作品の登録解除時にID重複診断から該当パスを外す
status: To Do
assignee: []
created_date: '2026-09-25 03:57'
labels:
  - bug
  - server
  - scan
dependencies: []
priority: medium
ordinal: 529000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
背景: TASK-469.1レビューでの範囲外発見。手動登録解除（unregisterWork→deleteWorkCatalog）はメタ削除後もidentityConflicts行を残すため、次のscanまでFilesにゴースト診断が出る。再設定経路は直後のフルスキャン（replaceIdentityConflicts）で消えるので影響しない。

仕様（アドバイザー判断 2026-09-25）: 登録解除時は該当workIdの該当path（target.metaPathの親のroot相対パス）を衝突から除き、残りpathが2未満なら診断ごと消す。reassignIdentityConflictが同じ計算をflatMapで持っているため、catalogWorkRepositoryかworkRegister側に共通関数（例 removeIdentityConflictPath(workId, path)）を切り出して両者から使う。

進め方: TASK-469.2の後に着手。feat/root-reconfigureとは別の小ブランチでmasterへ直接--no-ffマージしてよい。関連: TASK-442（reassignのコピー側パス選択の不具合）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 登録解除後にlistIdentityConflictsから該当pathが消え、残りpathが2未満なら診断ごと消えることをreal adapterのテストで確認している
- [ ] #2 reassignIdentityConflictが同じ共通関数を経由している
- [ ] #3 pnpm check && pnpm test が通る
<!-- AC:END -->
