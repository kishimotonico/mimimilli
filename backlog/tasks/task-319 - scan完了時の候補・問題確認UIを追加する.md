---
id: TASK-319
title: scan完了時の候補・問題確認UIを追加する
status: To Do
assignee: []
created_date: '2026-08-12 12:18'
labels: []
dependencies:
  - TASK-313
priority: medium
ordinal: 329000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-318の確認UI側。scan完了時に新規登録候補・identity_conflict・不正sidecarのいずれかがある場合のみ確認UIを表示する（2026-08-12決定。何もなければ従来どおり無人で完了）。UI仕様: scan進捗UIの完了状態から遷移するパネルまたはダイアログ／候補一覧はチェックボックス付きリスト（フォルダーパス・推定タイトル・音声ファイル数を表示、既定は全選択）／操作は「すべて登録」「選択したものを登録」「選択したものを除外」の3つ／identity_conflict・不正sidecarは同じ画面に問題セクションとして件数と一覧を表示（解決操作はTASK-317のinspector導線へ）／除外したフォルダーは以後の候補に出ない。デザインはdocs/design-system.md準拠。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 候補または問題があるときだけ確認UIが表示され、ゼロなら表示されない
- [ ] #2 候補一覧から全件登録・選択登録・除外が実行できる
- [ ] #3 除外が永続化され、次回scanの候補に出ない
- [ ] #4 identity_conflictと不正sidecarが問題セクションに件数つきで表示される
- [ ] #5 pnpm test:smokeが通り、候補承認フローのsmokeがある
<!-- AC:END -->
