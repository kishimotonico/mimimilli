---
id: TASK-142
title: 設定API障害を初回セットアップ画面と誤表示しない
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 12:33'
updated_date: '2026-07-30 15:41'
labels: []
dependencies: []
priority: high
ordinal: 152000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設定取得の失敗が「初回セットアップ未完了」に偽装される（敵対的検証済み・Codexレビュー指摘#3）。API停止・DB障害・契約不一致がすべてセットアップ画面になり、根本原因がユーザーから見えない。エラー隠蔽（AGENTS.mdで禁止）の典型例。

事実:
- client/src/app/App.tsx:46-52 の isSetupDone 導出で、settingsQuery.isError 分岐と rootFolder 未設定分岐が両方 false に収束し区別されない
- App.tsx:182-184 で !isSetupDone は一律 SetupScreen へ。エラー専用画面の分岐は存在しない
- useSettingsQuery は retry:1 のため、API障害時は数秒で確実に誤ったセットアップ画面へ落ちる

方向: loading / error / setup-required / ready を明示的に分け、取得失敗には再試行可能な起動エラー画面を出す。

関連: TASK-124でsettingsQueryの購読自体は意図的にApp.tsxに残された経緯あり（購読の場所は変えなくてよい。状態の判別だけ直す）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 設定APIが失敗した場合、セットアップ画面ではなく再試行導線付きのエラー表示になる
- [x] #2 rootFolder未設定（正常なセットアップ未完了）の挙動は現状と同じ
- [x] #3 pnpm check・pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. App.tsxのisSetupDone導出をpending/error/setup-required/readyの判別に変更
2. エラー時は再試行導線付きの起動エラー表示を追加
3. rootFolder未設定時の挙動は現状維持
4. テスト追加、pnpm check + pnpm test:client
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor(composer-2.5)で実装。判別ロジックをresolveAppStartupState純関数に切り出しユニットテスト追加。client check(tsc+oxlint)とtest:client 365件を統括側でも再実行し通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
起動時の設定取得をloading/error/setup-required/readyの4状態で判別するresolveAppStartupStateを追加し、エラー時は再試行ボタン付きStartupErrorScreenを表示するようApp.tsxを変更。rootFolder未設定の挙動は不変。
<!-- SECTION:FINAL_SUMMARY:END -->
