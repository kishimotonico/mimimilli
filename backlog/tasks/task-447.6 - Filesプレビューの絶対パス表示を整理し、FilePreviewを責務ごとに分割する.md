---
id: TASK-447.6
title: Filesプレビューの絶対パス表示を整理し、FilePreviewを責務ごとに分割する
status: To Do
assignee: []
created_date: '2026-09-11 00:52'
labels:
  - ui
  - ux
  - triage
dependencies:
  - TASK-447.1
parent_task_id: TASK-447
priority: high
ordinal: 474000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-447 の「直す」判定のうち 428.18 を直す。ユーザー理由「適切なリファクタ・設計にすればOK。絶対パスのコピーはフォルダーのハンバーガーメニュー内に『絶対パスをコピー』を足す程度。テキスト表示は画面情報の重複が多い」。FilePreview.tsx は パネル枠・登録mutation・作品タイトル取得・3種のエラー表示・リサイズドラッグの5責務が同居している（tmp/uiux-triage-2026-09-11/design-review.md (C)）。404・登録済み・再生状態の矛盾解消とプレビュー可変幅は残す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 絶対パスのコピーはフォルダーのメニューの「絶対パスをコピー」1項目で提供され、プレビュー内の絶対パスのテキスト表示と説明文が無い。フォルダーのメニューが無い場合は着手前に配置案を統括へ報告している
- [ ] #2 404・登録済み・再生状態の表示とプレビュー可変幅・ドラッグリサイズの挙動が変わっていない
- [ ] #3 FilePreview.tsx が責務ごとのモジュールに分割され、TASK-415 のメディア描画と登録ワークフローの境界が保たれている
- [ ] #4 UI変更（パスコピー移設・テキスト削除）と分割リファクタが別コミットになっている
- [ ] #5 着手前後のスクリーンショット（fixture、1440x900）を tmp/uiux-triage-2026-09-11/shots-intake/447.6-before.jpg と tmp/uiux-triage-2026-09-11/shots-intake/447.6-after.jpg に置き、タスクメモから参照している
- [ ] #6 変更範囲のテストが通り、既存テストの期待値を削除・緩和していない（仕様変更で書き換えた期待値はタスクメモに列挙）
<!-- AC:END -->
