---
id: TASK-513.3
title: 4タブ共通の一覧状態・件数・着地タブをそろえる
status: To Do
assignee: []
created_date: '2026-11-20 10:40'
labels:
  - scan
  - ui
dependencies:
  - TASK-513.1
references:
  - 'https://claude.ai/artifact/XvdN9UKvcg9GtL2gixXQ34'
documentation:
  - docs/adr/0039-scan-modal-current-problems-and-explicit-states.md
parent_task_id: TASK-513
priority: high
ordinal: 591000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0039「骨格とタブ」「「分からない」を空や完了と区別する」の一覧側。今は未登録タブが読み込み中・読み込み失敗でも「未登録の候補はありません。」と出し（監査H3、確認済み。loaded未使用、ScanRuntime.tsxで失敗を握りつぶし）、タブごとに空表示の作りと文言がばらばら。サイドバーの件数は選択中に消えて行の高さが6px変わる（M4）。開いたときは空でも未登録固定（M1）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 4タブが共通の部品で、読み込み中（スケルトン）・読み込み失敗（再試行つき）・まだスキャンしていない・0件を区別して出す。要対応は「まだスキャンしていない」を持たない。空表示にスキャンボタンを置かない
- [ ] #2 候補一覧の起動時の取得失敗を握りつぶさず、読み込み失敗として出す
- [ ] #3 サイドバーの件数は全タブに出し、0件と件数不明のときは出さない。選択中のタブでも消えず、件数の有無でタブの行の高さが変わらない
- [ ] #4 開いたときは件数のあるタブを未登録→要対応→新規作品→更新済みの順に探して開く。スキャン完了時は今のタブが空のときだけ同じ規則で移る
- [ ] #5 一覧の上のツールバー行は未登録・更新済みにだけ置く。新規作品・更新済みに「〜のスキャン」の見出しを置かない
- [ ] #6 pnpm test:smoke の該当シナリオを更新して通している
<!-- AC:END -->
