---
id: TASK-137
title: clientのAPI取得経路を統一する（scan独自fetchの共通化・App.tsxのensureQueryData化）
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 12:31'
updated_date: '2026-07-30 16:21'
labels: []
dependencies: []
priority: medium
ordinal: 147000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
clientのデータ取得の一貫性改善2点（検証済み）。

1. scan APIだけ独自HTTPクライアント: client/src/features/scan/api.ts:29-39 は共通helper（client/src/shared/api/http.ts:37-44 の apiErrorSchema パース）を使わず、非ok応答のcode/messageを一律 "request_failed" に置換して契約エラー情報を潰している。scan固有事情は409のconflict body（api.ts:43-47）と204のnull扱い（:54,:77）のみで、共通helper側に204許容・409カスタムハンドラを拡張すれば吸収可能
2. App.tsxの命令的fetchがQuery cacheを迂回: client/src/app/App.tsx:72-75,107-110 の getQueryData() ?? getWork() パターンはcache未登録時の取得結果をキャッシュへ登録せず、同時取得のdedupも受けない。queryClient.ensureQueryData() へ統一する（.oxlintrc.jsonのApp.tsx override はfeatures/*/model importの制限であり抵触しないことを確認済み）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 scan APIが共通HTTP helper経由になり、サーバーのエラーcode/messageが保持される（409・204の挙動は現状維持）
- [x] #2 App.tsxの2箇所がensureQueryDataに置き換わっている
- [x] #3 pnpm check・pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 共通HTTP helperに204許容・409カスタムハンドラを拡張
2. scan/api.tsを共通helper経由に統合しエラーcode/message保持
3. App.tsxのgetQueryData()??getWork()をensureQueryDataへ
4. pnpm check + pnpm test:client
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor(composer-2.5)で実装。http.tsにnoContentAsNull(204)とonStatus(409等)を追加しscan/api.tsの独自fetchを廃止。App.tsxの2箇所をensureQueryDataへ。client check + test:client 389件 + 全体check通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
scan APIを共通HTTP helper経由にしてサーバーのエラーcode/messageを保持。App.tsxの命令的fetchをensureQueryDataに置き換えcache登録とdedupを効かせた。
<!-- SECTION:FINAL_SUMMARY:END -->
