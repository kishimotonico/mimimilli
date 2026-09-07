---
id: TASK-428.6
title: ルートフォルダー変更を検証して再スキャンへ案内する
status: To Do
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 14:48'
labels:
  - ui
  - settings
  - validation
dependencies:
  - TASK-428.2
modified_files:
  - server/src/routes/settings.ts
  - client/src/features/settings/ui/SettingsModal.tsx
parent_task_id: TASK-428
priority: high
ordinal: 433000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
settings-setup-errors-A-02/B-03/A-16/B-19。存在しないパスを保存でき、失敗時と成功後の次の操作が分からない。server/fixtureで同じ検証契約を使い、成功後は再スキャンへつなぐ。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 存在するディレクトリだけを保存でき、無効なパスはユーザー向け400エラーになる
- [x] #2 保存中は重複送信できずボタンに保存中と表示される
- [x] #3 成功通知のスキャンactionからスキャンモーダルを開ける
- [x] #4 pnpm test:smokeに新規失敗がない
- [x] #5 ルートフォルダー保存成功後から再スキャン完了まで、設定モーダルのルートフォルダー項目直下にinline noticeで「一覧は変更前のフォルダーの内容です。再スキャンすると新しいフォルダーの内容に更新されます。」と表示する
- [x] #6 リロード後・サーバー再起動後も、再スキャンが完了するまで案内が出続ける
<!-- AC:END -->
