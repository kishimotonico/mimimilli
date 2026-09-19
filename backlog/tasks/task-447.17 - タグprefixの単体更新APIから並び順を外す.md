---
id: TASK-447.17
title: タグprefixの単体更新APIから並び順を外す
status: Done
assignee: []
created_date: '2026-09-11 05:35'
updated_date: '2026-09-11 05:55'
labels:
  - bug
  - triage
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 485000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー第2回（tmp/uiux-triage-2026-09-11/followup-2.md の C）。shared/src/tagPrefix.ts の tagPrefixUpdateSchema に order が残り、PATCH /tag-prefixes/:prefix で1行だけ順位を変えて重複順位・欠番を作れる。並び替えは一括 API（PUT order）だけにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 tagPrefixUpdateSchema と通常の更新処理（real/fixture adapter）から order が外れ、PATCH で order を送っても順位が変わらない（スキーマで拒否または無視のどちらかを契約テストで固定）
- [x] #2 クライアントで PATCH に order を渡している箇所が無く、並び替えは一括 API だけを使っている
- [x] #3 変更範囲のテストが通り、既存テストの期待値を辻褄合わせで削除・緩和していない（仕様変更で書き換えた期待値はタスクメモに前後を列挙）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
order を tagPrefixUpdateSchema と real/fixture adapter の更新処理から削除。方針は既存のzodスキーマ（プロジェクト内どこも.strict()を使っていない）に合わせて「無視（strip）」を採用。ただし order だけを送るPATCHはstrip後に更新フィールドが空になり、既存のrefine（最低1フィールド必須）により400になる（元々の空PATCH拒否と同じ挙動）。client は元々一括APIのみ使用しており変更不要。既存テスト server/tests/tagPrefixes.test.ts の「PATCH...: order を直接更新できる」を「order のみは400」「order+他フィールドはorder無視で他フィールドだけ反映」の2本に書き換えた。
<!-- SECTION:NOTES:END -->
