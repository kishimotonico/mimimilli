---
id: TASK-42
title: DLsiteタイトル適用ポリシーの改善（初期値タイトルなら既存作品でも適用）
status: Done
assignee:
  - '@claude'
created_date: '2026-07-17 13:48'
updated_date: '2026-07-17 14:03'
labels: []
dependencies: []
priority: high
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
既存作品向け一括取得（runDlsiteBulk mode="existing"）はユーザー編集タイトルの保護のためタイトルを適用しないが、タイトルがフォルダ名のまま（例「RJ01620477」）の作品でも発動し、DLsite取得成功後もタイトルがRJコードのまま残る。実ライブラリで7件確認済み。

方針:
- 「タイトルが初期値のまま」＝タイトルが物理フォルダ名（basename(physicalPath)）またはrjCodeと一致する場合は、existingモードでもDLsiteタイトルを適用する
- ユーザーが編集したタイトル（上記に一致しない）は引き続き保護
- 適用方針の正典は server/src/adapters/real/index.ts の runDlsiteBulk（mode判定部）。手動適用ダイアログ（applyTitleチェック）は現状維持

関連: server/src/adapters/real/index.ts:340-447, scanner.ts:391（title=basename(workDir)）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 タイトルがフォルダ名/RJコード一致の作品は、existingモードの一括取得でDLsiteタイトルに更新される
- [x] #2 ユーザー編集済みタイトルはexistingモードで上書きされない
- [x] #3 既存のタイトルがRJコードのままの作品が、再取得（一括または個別）で正しいタイトルになる
- [x] #4 適用判定のユニットテストがある
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Sonnetサブエージェント（worktree/task42）に委譲。完了・マージ後に同エージェントがTASK-43を継続。検証・コミットはClaude側
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnetエージェント（worktree/task42）実装をレビューしマージ（a8c165d）。server/src/core/dlsiteTitle.ts の isDefaultTitle（title==basename(physicalPath) or ==rjCode、case-insensitive）でexistingモードのタイトル適用を判定。旧仕様をアサートしていた既存テストは新仕様に更新。実データ修復: applied済みでRJコードタイトルの7件を個別fetch→applyTitle=trueで適用し、全件実タイトルに更新済み（API実機確認）。既知エッジ: wav/mp3のフォーマット別サブフォルダ作品はスキャナー粒度の問題として対象外。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
existing一括取得でタイトルが初期値（フォルダ名/RJコード一致）なら適用するよう判定関数isDefaultTitleを導入。ユーザー編集タイトルは保護。既存7件は個別取得APIで修復済み。unit test追加、check/test通過。
<!-- SECTION:FINAL_SUMMARY:END -->
