---
id: TASK-42
title: DLsiteタイトル適用ポリシーの改善（初期値タイトルなら既存作品でも適用）
status: To Do
assignee: []
created_date: '2026-07-17 13:48'
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
- [ ] #1 タイトルがフォルダ名/RJコード一致の作品は、existingモードの一括取得でDLsiteタイトルに更新される
- [ ] #2 ユーザー編集済みタイトルはexistingモードで上書きされない
- [ ] #3 既存のタイトルがRJコードのままの作品が、再取得（一括または個別）で正しいタイトルになる
- [ ] #4 適用判定のユニットテストがある
<!-- AC:END -->
