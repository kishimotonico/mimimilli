---
id: TASK-355
title: エラービューから欠損作品を一括削除できるようにする
status: Done
assignee:
  - '@claude-sonnet'
created_date: '2026-08-19 16:24'
updated_date: '2026-08-19 17:12'
labels: []
dependencies:
  - TASK-299
ordinal: 356000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
物理ファイル喪失（フォルダー移動・ドライブ変更等）で欠損した作品が大量に残ったとき、1件ずつの削除（TASK-299）ではつらい。エラービュー表示中に「欠損作品をまとめて削除」導線を追加し、status === "missing" の作品だけを一括でライブラリ登録解除する。status === "error"（メタ読込エラー）は復旧可能性があるため対象外。チェックボックス等の汎用選択機構は作らない（それはDRAFT-53の範囲のまま）。

安全策は確認ダイアログのみ（2026-08-20決定）: 対象件数と「再生履歴・ブックマーク等のユーザーデータも削除される」「ドライブ未接続等の一時的な欠損なら、接続後に再スキャンすれば再登録できる（ユーザーデータは戻らない）」旨を明記する。共通ConfirmDialog（client/src/shared/ui/ConfirmDialog.tsx）を使う。

サーバー側はunregisterWork（server/src/adapters/real/workRegister.ts）をmissing作品全件に対して回す一括エンドポイントを新設し、削除件数を返す（クライアントからN回DELETEを投げるループは不可）。一部失敗時も残りを続行し、失敗件数を返すこと。削除後はworks系クエリ無効化に加え、選択中作品が消えた場合の選択解除と、エラービューが0件になって軸レールから消える場合のビュー遷移（デフォルトビューへフォールバック）が破綻しないこと。TASK-299（単体削除）の後に実施する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 エラービュー表示中の導線から、missing状態の作品を一括でライブラリ登録解除できる（確認ダイアログに件数とデータ喪失・再スキャン再登録の説明を明記）
- [x] #2 status === "error" の作品は一括削除の対象にならない
- [x] #3 削除後、一覧・件数が即時更新され、エラービューが0件になった場合はビュー遷移が破綻しない
- [x] #4 一括削除は単一のサーバーAPIで行われ、一部失敗時も残りが処理されて結果件数が返る
- [x] #5 pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. サーバーに欠損作品一括登録解除エンドポイント新設（missing全件をunregisterWorkで処理、一部失敗は続行し件数返却）
2. real/fixture両adapterで実装（fixtureはモックシナリオで動作確認できるように）
3. クライアント: エラービュー表示中の導線+ConfirmDialog（件数・データ喪失・再スキャン再登録を明記）
4. 削除後: works系無効化、選択解除、エラービュー0件時の遷移確認
5. worktree .worktrees/task-355（feat/work-deletion起点、TASK-299マージ済み）、実装@claude-sonnet
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装: task-355ブランチ 574f316。GET /works/missing-count（{count}）とPOST /works/unregister-missing（{deletedCount, failedCount}）を新設（/works/:idより前に定義）。real/fixture両adapterに実装し、HTTP経由で両方を通す契約テストでmissingのみ対象・errorは無傷・件数の意味論を担保。クライアントはErrorViewBulkDeleteBanner（activeAxis=error時のみ、missing 0件で非描画）+共通ConfirmDialog。smartFolderBanner propをresultsBannerへリネーム（影響はLibraryView/WorkGrid/WorkListPaneに閉じることをレビューで確認）。check全通過・unit 1501件・smoke 16/16（初回の軸一覧タイムアウトは単体3.4秒+フル再実行で既存フレーキーと裏取り）。実機確認: missing+error混在でmissingのみ削除・error残存、エラービュー0件化でもUI破綻なし、ダイアログ文言仕様通り。レビュー担当による副作用チェック: なし
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
エラービュー表示中に「欠損作品をまとめて削除」バナーを追加し、missing状態の作品だけを一括でライブラリ登録解除できるようにした。確認ダイアログに件数・データ喪失・再スキャンで再登録可能な旨を明記。サーバーに一括API（deletedCount/failedCount返却、一部失敗でも続行）とmissing件数APIを新設し、real/fixture両adapterの契約テストで担保
<!-- SECTION:FINAL_SUMMARY:END -->
