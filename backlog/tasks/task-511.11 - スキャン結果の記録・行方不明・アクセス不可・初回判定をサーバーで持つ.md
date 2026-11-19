---
id: TASK-511.11
title: スキャン結果の記録・行方不明・アクセス不可・初回判定をサーバーで持つ
status: Done
assignee: []
created_date: '2026-11-19 00:39'
updated_date: '2026-11-19 05:15'
labels:
  - scan
dependencies:
  - TASK-511.4
references:
  - 'https://claude.ai/artifact/GbuEuRQyKeD9xN4CM3Fv1k'
documentation:
  - docs/adr/0034-scan-modal-restructure.md
parent_task_id: TASK-511
priority: high
ordinal: 580000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0034の「スキャン結果の寿命はサーバーのメモリだけ」「スキャン結果は作品ごとに変化の種類を返す」の初回判定と、要対応の実行単位の項目をサーバー・sharedで実装する。既存クライアントの呼び出し元（client/src/features/scan/model/formatScanResult.ts、client/src/features/scan/ui/ScanRuntime.tsx の完了トースト、client/src/app/ui/NotificationBell.tsx の直近のスキャン結果、client/src/features/scan/ui/scanModal/NewlyRegisteredTab.tsx・scanResultWorkIds.ts）もこのタスクで追随させる。

現状: insertedWorkIds は「catalogに無い」だけの意味で、初回やルート変更では全作品が入る（server/src/adapters/real/scanRegister.ts）。結果はメモリの lastCompleted（server/src/scanJobManager.ts）。候補から追加した作品IDはクライアントの useState（client/src/features/scan/ui/ScanModal.tsx）に溜めている。表示は200件で切れる（scanResultWorkIds.ts、WORKS_DEFAULT_PAGE_SIZE）。行方不明は件数（missing）しか返さない。unreadablePaths は返しているが画面に出ていない。

決めてあること（ADR-0034）:
- 新規作品（候補から追加した作品とスキャンで自動登録された作品）と更新済みの記録、要対応の実行単位の項目（今回新たに行方不明になった作品・アクセス不可のパス・dataIntegrityWarning）はサーバーのメモリに持ち、寿命は次のスキャンかサーバー再起動まで。永続化はしない。件数で切らない。
- スキャン開始時点でcatalogに作品が1件もなければ、そのスキャンの新規作品の記録は空にする。root再設定後の構築（ADR-0029）でも同じ規則。
- 件数つきのスキャン完了トーストは廃止する。スキャン自体の失敗トーストは残す。
- ID重複と読み取り失敗は今までどおり GET /api/scan/diagnostics から読む。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 新規作品の記録に、スキャンで自動登録された作品と候補から追加した作品の両方が入り、モーダルを閉じても件数の上限なく取得できる
- [x] #2 記録と実行単位の要対応項目は次のスキャンで入れ替わり、サーバー再起動後は次のスキャンまで空で返る
- [x] #3 スキャン開始時点でcatalogが空のとき（初回・root再設定後の構築を含む）、新規作品の記録が空になる
- [x] #4 今回のスキャンで新たに行方不明になった作品（旧パス・タイトル付き）とアクセスできなかったパスが取得できる。以前から行方不明の作品は含まれない
- [x] #5 件数つきのスキャン完了トーストが出ず、スキャンが失敗したときのトーストは出る
- [x] #6 real/fixture両アダプタで契約を満たし、既存クライアントの呼び出し元が追随していて、pnpm check・pnpm test・pnpm test:smoke が通る
- [x] #7 作品の登録解除と作品単位の読み直し（TASK-511.5）で、メモリの記録から該当作品の行方不明・データ不整合の項目が消える
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
スキャン結果の記録（新規作品・更新済み・今回新たに行方不明・アクセス不可・データ不整合）をサーバー層のScanRecordStoreに次のスキャンまで持つ。GET /scan/lastは常に200でScanRecordを返し、作品本体はGET /works?scanRecord=new|updated（scanChange絞り込み）から件数の上限なく取る。ジョブ結果とSSEのcompletedは結果を持たない。catalogが空のスキャンでは新規作品を空にし、スキャン中の候補追加は引き継ぎ、スキャン中の登録解除・読み直しは戻さない。行方不明の更新をスキャン開始時にあった作品に限定し、スキャン中に登録した作品を行方不明にしない（applyScanVerdict）。完了トーストを廃止し、必須更新にscan lastを加えた。ADR-0034に置き換え節を追記。
<!-- SECTION:FINAL_SUMMARY:END -->
