---
id: TASK-511.9
title: 作品詳細のDLsite差分計算を一本化し、サーバーがキャッシュから読む
status: To Do
assignee: []
created_date: '2026-11-19 00:25'
updated_date: '2026-11-19 00:54'
labels:
  - dlsite
dependencies:
  - TASK-511.3
  - TASK-511.8
documentation:
  - docs/adr/0033-dlsite-fetch-before-register.md
parent_task_id: TASK-511
priority: medium
ordinal: 578000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0033の「既存の作品は作品詳細から、差分を確認して反映する」「追加と適用の契約」の作品詳細の部分を実装する。既存クライアント（client/src/features/library/ui/preview/DlsiteEditor.tsx と、適用の mutation）もこのタスクで追随させる（互換レイヤーは作らない）。

現状: 差分計算がクライアント（client/src/entities/work/dlsitePreview.ts の computeDlsiteApplyDiff、タイトルを置き換える）とshared（shared/src/dlsite.ts の computeMissingDiff、未設定項目だけでタイトルなし）の2系統。適用（POST /dlsite/:id/apply、server/src/adapters/real/dlsiteApply.ts の dlsiteApply）はクライアントが送った info（DlsiteApplyBody）を信用し、カバーを適用時に取得する（stageCover）。

決めてあること（ADR-0033）:
- 作品詳細の適用は、タグ単位の選択（配列）を受け取る形を維持する。DLsite情報はサーバーがキャッシュから読み、クライアントから info を受け取らない。sourceRevision の確認は従来どおり。
- 適用時にそのRJコードのキャッシュがmiss（TTL切れを含む）なら、エラーを返して再取得を促す。
- 適用の処理でDLsiteへHTTPを出さない。キャッシュにカバーが無いときは、カバーだけ反映せずほかの項目は反映して続行する。
- 差分計算は shared の1実装にまとめる。computeMissingDiff は apply-missing の廃止（TASK-511.8）で使い手がなくなるので、このタスクで削除する（511.8の後に着手する）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 差分計算が shared の1実装だけになり、クライアントとサーバーが同じ関数を使う。computeMissingDiff と computeDlsiteApplyDiff の重複が無い
- [ ] #2 作品詳細の適用が、タグ単位の選択を受け取り、DLsite情報をサーバーがキャッシュから読む。クライアントから取得結果（info）を受け付けない
- [ ] #3 適用の処理でDLsiteへHTTPを出さないことをテストで縛っている。キャッシュにカバーが無いときは、カバー以外を反映して適用が成功する
- [ ] #4 sourceRevision が一致しない適用は従来どおり拒否される
- [ ] #5 タイトルの扱いが候補の追加（TASK-511.3）と同じになっている
- [ ] #6 real/fixture両アダプタで契約を満たし、DlsiteEditorが追随していて、pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->
