---
id: TASK-41
title: DLsite一括連携の可視化（RJコード未検出の通知と一括取得の導線）
status: Done
assignee:
  - '@claude'
created_date: '2026-07-17 12:19'
updated_date: '2026-07-17 12:54'
labels: []
dependencies: []
priority: medium
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スキャン後のDLsite自動一括取得（TASK-37）は実装済みだが、対象は「rjCode検出済み（フォルダ名にRJコード）」の作品のみで、未検出の作品は静かに取り残され、ユーザーからは都度手動取得しか無いように見える。また「未連携をまとめて取得」ボタンが設定モーダルの奥にあり発見性が低い。

方針（スキャン・更新まわりのUI/機能は互換性を気にせず長期目線でベストな形に再設計してよい）:
- スキャン完了時に「◯件はRJコード未検出」を通知し、該当作品の一覧とコード入力への導線を出す
- 「未連携をまとめて取得」をライブラリ画面側（ツールバーや通知系UIなど）から起動できるようにする。DRAFT-6（通知ベル）との統合も検討してよい
- 一括取得の進捗・失敗の既存可視化（SSE・バッジ・失敗一覧）と整合させる

関連: server/src/routes/scan.ts:39-60（enqueueDlsiteJob）, server/src/routes/dlsite.ts, dlsiteProgress.ts, client SettingsModal.tsx:334-354, useDlsiteBulk.ts, server/src/adapters/real/index.ts runDlsiteBulk（適用方針の正典）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 スキャン完了後、RJコード未検出の作品数が通知され、該当作品の一覧に到達できる
- [x] #2 一覧から各作品のRJコード入力（→取得）へ迷わず進める
- [x] #3 未連携の一括取得を設定モーダルを開かずにライブラリ画面から起動できる
- [x] #4 一括取得の進捗・失敗の既存可視化と矛盾しない
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 実装はSonnetサブエージェント（worktree隔離）に委譲、TASK-38のCodexと並行
2. スキャン完了通知にRJコード未検出件数を追加し、該当作品一覧＋コード入力導線を用意
3. 未連携一括取得をライブラリ画面（ヘッダーのスキャン/通知まわり）から起動可能に
4. pnpm check/testはエージェント側、ブラウザ検証とコミットはClaude側
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnetサブエージェント（worktree/task41ブランチ）に実装委譲しmasterへマージ（コンフリクトなし）。shared: isRjCodeMissing/ScanResult.rjCodeMissingCount追加。client: useDlsiteBulkをApp単一インスタンスへリフト、TopBarに一括取得ボタン＋通知ベルにRJ未検出バッジ、RjCodeMissingModal新設、NewWorkPopupに件数バッジ＋確認導線。統合修正（Claude）: TASK-39でDLsiteフォームが閲覧ビューから消えたため、WorkStatusWarningsにRJコード未検出の案内＋「連携設定を編集」導線を追加。RjCodeMissingModalをインラインstyleからTailwindユーティリティ＋useDialogModal流儀に統一。実機検証: ベルバッジ3件→一覧→詳細→警告→編集ダイアログ、一括取得ボタンPOST /dlsite/bulk 202＋SSE接続を確認。check/test/visualベースライン更新済み。既知の制約: リロード直後に進行中ジョブへ自動attachしない（useScanProgressと同設計）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
スキャン完了時のRJコード未検出件数を契約に追加し、通知ベルのバッジ・一覧モーダル・作品詳細の警告導線で可視化。未連携一括取得をTopBarから起動可能にし、SSE進捗と統合。実機検証・ビジュアルベースライン更新済み。
<!-- SECTION:FINAL_SUMMARY:END -->
