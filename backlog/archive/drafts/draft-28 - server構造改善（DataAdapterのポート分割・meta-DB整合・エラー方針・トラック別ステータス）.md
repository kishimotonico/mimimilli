---
id: DRAFT-28
title: server構造改善（DataAdapterのポート分割・meta/DB整合・エラー方針・トラック別ステータス）
status: Draft
assignee: []
created_date: '2026-07-19 03:10'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー(2026-07-19)指摘11,13,16,17のまとめ。いずれも裏取り済みの事実だが緊急性は低く、該当領域を触るタスクのついでに段階的に直す方針。

- 指摘11: DataAdapter（server/src/adapter.ts:54）が20超メソッドの巨大interfaceで、全機能がfixture/real両方の同時変更を要求する。WorkRepository/SettingsStore/MediaLocator等のポートとScanService/DlsiteService等のユースケースへ分割
- 指摘13: .meta.jsonとDBの二重書き込みにDB↔FSのアトミック性・世代管理・外部エディタ競合検知がない（real/index.ts:163-168、dlsiteカバーDLはtransaction外で孤児ファイルも発生しうる）。metaのrevision/更新前ハッシュ比較等の回復設計
- 指摘16: エラー処理が「握りつぶし/console/UI通知」の3系統に分裂。エラー種別ごとの方針（通知/再試行/診断ログ）定義と共通reporter、サーバーログの構造化（request ID付与）
- 指摘17: probe失敗がduration=0で継続し（probe.ts:23-29）、トラック単位の再生可能性・破損を表現できない。トラック別ステータスを追加し作品ステータスは導出に

関連: 指摘12（fixture/real conformance test不在）もDataAdapter分割とセットで検討。fixture側は区間トラック（start/end）を合成できず、real固有挙動をUI開発で再現できない問題もある。
<!-- SECTION:DESCRIPTION:END -->
