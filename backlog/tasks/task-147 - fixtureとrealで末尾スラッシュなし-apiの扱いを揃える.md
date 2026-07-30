---
id: TASK-147
title: fixtureとrealで末尾スラッシュなし/apiの扱いを揃える
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 12:34'
updated_date: '2026-07-30 16:33'
labels: []
dependencies: []
priority: low
ordinal: 157000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
開発時のfixture経路とreal proxy経路で /api（末尾スラッシュなし）の扱いが非対称（敵対的検証済み・Codexレビュー指摘#41、実害は現状ゼロの潜在問題）。

事実:
- client/vite.config.ts:111-113 fixture用ミドルウェアは req.url?.startsWith("/api/") のみAPI扱いで、/api 単体はSPA fallbackへ
- client/vite.config.ts:138 real用 proxy: {"/api": ...} は接頭辞マッチで /api 単体もプロキシされる
- 現状のclientコードは常に API_BASE("/api") + "/path" の形で叩くため実害はないが、将来 /api 直叩き（ヘルスチェック等）が入るとfixtureとrealで挙動が分かれる

方向: fixture側の判定を pathname === "/api" || pathname.startsWith("/api/") に揃える（クエリ付きURLも考慮しpathnameを解析する）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 fixture開発サーバーで /api および /api?x=1 がSPA fallbackに落ちずAPI側で処理される
- [x] #2 pnpm check が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. vite fixtureミドルウェアの/api判定をpathname解析でrealプロキシと揃える
2. pnpm --filter client check
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor(composer-2.5)で実装。pathname解析でクエリ付き/apiも正しくAPI側へ。client check通過（fmtズレは並行TASK-138の作業中ファイルのみ）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
fixture用ミドルウェアの/api判定をpathname解析にしてrealプロキシと挙動を揃えた。
<!-- SECTION:FINAL_SUMMARY:END -->
