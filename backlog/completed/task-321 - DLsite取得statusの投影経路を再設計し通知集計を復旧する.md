---
id: TASK-321
title: DLsite取得statusの投影経路を再設計し通知集計を復旧する
status: Done
assignee: []
created_date: '2026-08-12 16:54'
updated_date: '2026-08-14 07:44'
labels: []
dependencies: []
priority: high
ordinal: 331000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
source-projection移行でDLsite取得の一時状態をcacheへ移した結果、dlsite.statusがmimimilli.json・catalogへ書かれる経路が実質失われた。既存作品への適用ではstatusがappliedにならず、取得失敗もnot_found/errorとして記録されない。一方 server/src/adapters/real/workQuerySql.ts:281-297 は今もstatusをSQLで集計しているため、通知ベルの取得失敗件数が常に0、適用済み作品が未連携件数に残り続け、DLsiteのHTML構造変化を検知するパースエラー警報が発火しない。statusを一時状態として扱うのか永続的な分類として扱うのかを決め、投影経路を設計し直す。新規登録経路（server/src/adapters/real/workRegister.ts:348）だけはappliedを書いている。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 既存作品へDLsite情報を適用した後、その作品が未連携件数に含まれなくなる
- [x] #2 DLsite取得の失敗が通知ベルの取得失敗件数へ反映される
- [x] #3 パースエラー警報が発火する条件が実データの流れで満たされる
- [x] #4 statusの位置づけ（sidecar正本かcache由来か）がADR-0017に明記されている
- [x] #5 上記を検証するテストがある
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-08-13 17:42
---
設計レビュー引き継ぎ時の追加決定: TASK-328の外部連携状態表示が本タスクのstatus投影修復に依存するため、スキャンUI再設計パッケージ（feat/scan-ui-redesign）に組み込む。TASK-324・325と並列で先行実施し、TASK-328の前に完了させる。
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
連携分類(applied/skipped/none)をmimimilli.json正本、取得失敗(not_found/error/parse_error)をDLsiteキャッシュへ分離し、catalogのwork_dlsite.state_jsonを両者の合成投影にした。取得を伴う全経路（単発取得・一括取得・一括適用）で投影をリフレッシュするようにし、通知ベルの取得失敗件数とパースエラー警報が実データで動くようになった。ADR-0017にstatusの位置づけを明記。verified: 実データの流れを通すテスト、pnpm check && pnpm test、pnpm test:smoke。
<!-- SECTION:FINAL_SUMMARY:END -->
