---
id: TASK-137
title: clientのAPI取得経路を統一する（scan独自fetchの共通化・App.tsxのensureQueryData化）
status: To Do
assignee: []
created_date: '2026-07-30 12:31'
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
- [ ] #1 scan APIが共通HTTP helper経由になり、サーバーのエラーcode/messageが保持される（409・204の挙動は現状維持）
- [ ] #2 App.tsxの2箇所がensureQueryDataに置き換わっている
- [ ] #3 pnpm check・pnpm test が通る
<!-- AC:END -->
