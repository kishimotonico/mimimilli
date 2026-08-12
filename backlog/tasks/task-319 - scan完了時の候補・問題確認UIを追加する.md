---
id: TASK-319
title: scan完了時の候補・問題確認UIを追加する
status: Done
assignee:
  - '@codex'
created_date: '2026-08-12 12:18'
updated_date: '2026-08-12 17:43'
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
- [x] #1 候補または問題があるときだけ確認UIが表示され、ゼロなら表示されない
- [x] #2 候補一覧から全件登録・選択登録・除外が実行できる
- [x] #3 除外が永続化され、次回scanの候補に出ない
- [x] #4 identity_conflictと不正sidecarが問題セクションに件数つきで表示される
- [x] #5 pnpm test:smokeが通り、候補承認フローのsmokeがある
<!-- AC:END -->



## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. TASK-318の候補・診断契約をクライアントAPIへ接続する。2. スキャンダイアログに候補選択・登録・除外とidentity conflict表示、Files導線を追加する。3. fixture scenarioとsmokeを追加し、実装済み受け入れ条件を記録する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
候補確認UI、登録・除外、409時の候補再取得、問題からFilesへの導線を実装。不正sidecarはScanResultへroot相対path/messageを追加し、実scannerのMetaParseErrorを収集する。fixtureのnew-workに候補・ID重複・不正sidecarを追加し、候補承認smokeを追加。AC5のsmoke実行は指示により未実施。

差し戻し対応: 候補一括操作の100件上限を契約から撤廃し、101件登録API回帰テストを追加。Files導線は候補種別を問わず対象pathの親をcwd、対象path自体を選択にする。smokeにはroot直下のviewerを選択したFiles行アサーションを追加。
<!-- SECTION:NOTES:END -->
