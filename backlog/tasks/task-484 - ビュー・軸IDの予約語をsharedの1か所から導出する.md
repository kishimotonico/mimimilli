---
id: TASK-484
title: ビュー・軸IDの予約語をsharedの1か所から導出する
status: Done
assignee:
  - '@mimi2'
created_date: '2026-10-02 11:46'
updated_date: '2026-10-08 04:12'
labels:
  - shared
  - client
  - refactor
dependencies: []
documentation:
  - backlog/docs/doc-6
priority: medium
ordinal: 542000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
viewIdSchema（shared/src/library.ts）、RESERVED_AXIS_IDS（shared/src/tagPrefix.ts）、client の VIEW_AXIS_IDS（axisDefinitions.ts）が手書きで並存し、ビューを足すと3箇所の同期が要る。smart- 接頭辞の判定も tagPrefixNameSchema・client の startsWith・navigationUrl.ts に散っている。予約語はビューID定義から導出し、smart- 判定はsharedの1関数にする。軸IDを判別共用体のパーサ型にする案はDRAFT-50の結論後に判断し、このタスクでは扱わない。詳細は doc-6 の shared-1。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 予約軸IDとclientのビュー軸ID一覧がsharedのビューID定義から導出され、手書きの重複リストが無い
- [x] #2 smart- 接頭辞の判定がsharedの1関数を通る
- [x] #3 予約語のprefix名を拒否する既存の挙動がテストで縛られている
- [x] #4 pnpm check && pnpm test が通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
VIEW_IDS を正にして RESERVED_AXIS_IDS と client のビュー軸ID一覧を導出、smart- 接頭辞の判定・組み立てを shared の関数に集約、予約語拒否をテストで縛った。 個別レビュー＋統合ブランチの横断レビュー、feat/audit-sweep 先端で pnpm check・test 全通過、smoke 29/30（失敗1件は別プロジェクトの vite とのポート衝突で、単体再実行3/3通過）。17736da3 で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
