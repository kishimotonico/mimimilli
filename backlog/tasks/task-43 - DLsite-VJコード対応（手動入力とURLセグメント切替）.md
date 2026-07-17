---
id: TASK-43
title: DLsite VJコード対応（手動入力とURLセグメント切替）
status: Done
assignee: []
created_date: '2026-07-17 13:48'
updated_date: '2026-07-17 17:24'
labels: []
dependencies:
  - TASK-42
priority: medium
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
VJ始まりの商業作品（例 VJ014780）がDLsite取得の入口から弾かれる。検出正規表現（server/src/adapters/real/dlsite.ts:21 RJ\\d{6,8}）、手動入力バリデーション（shared/src/dlsite.ts:63 ^RJ\\d{6,8}$）、URL構築（dlsite.ts:14 maniax固定）の3箇所ともRJ専用のため。

方針:
- 手動入力でVJコードを許可（sharedのZodバリデーション拡張）。フォルダ名からの自動検出はRJのみ維持（VJ作品は少数のため）
- URL構築をコードprefixで切替: RJ→maniax、VJ→pro（proで404ならsoftを試すかは実装時にDLsiteの実挙動を確認して判断。過度なフォールバックは避け、対応セグメントを明示する）
- 取得失敗時のエラーハンドリングは既存（not_found/parse_error/error）に整合

関連: shared/src/dlsite.ts, server/src/adapters/real/dlsite.ts, docs（RJコード表記をコード全般に更新する箇所があれば）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 編集ダイアログでVJコードを入力・保存でき、DLsiteから取得が成功する（VJ014780で実機確認）
- [x] #2 RJコードの既存動作（検出・取得）が変わらない
- [x] #3 不正な形式のコードは従来どおりバリデーションで弾かれる
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnetエージェント（worktree/task43）実装をレビューしマージ。dlsiteWorkUrlをprefix分岐（RJ→maniax、VJ→pro）、バリデーションを^(RJ|VJ)\d{6,8}$に拡張、VJテスト4件追加。追加でClaudeがUIラベル更新（aria-label RJ/VJコード、placeholder RJ123456 / VJ123456、エラーメッセージの表記）。実機検証: VJ014780で入力→保存→取得→適用まで成功（タイトル・サークル・CV・タグ・カバー反映、pro URLで取得確認）。check/test通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
VJコードの手動入力とpro URLでの取得に対応。RJ既存動作は不変、自動検出はRJのみ維持。VJ014780で実機検証済み。
<!-- SECTION:FINAL_SUMMARY:END -->
