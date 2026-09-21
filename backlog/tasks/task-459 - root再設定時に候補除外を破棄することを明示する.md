---
id: TASK-459
title: root再設定時に候補除外を破棄することを明示する
status: To Do
assignee: []
created_date: '2026-09-21 10:49'
labels: []
dependencies: []
ordinal: 513000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
scan_candidate_exclusions が root 相対 path のみを主キーに持ち root を識別しないため、root を変更すると除外の意図が無関係な root へ漏れ得る。単一の稼働ライブラリを置き換える使い方を前提に、再設定時は除外を破棄する。将来のプロファイル切り替え構想を根拠に root 別保持へ一般化しない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 root を再設定すると候補除外が破棄される
- [ ] #2 再設定で破棄される状態と保持される状態がユーザーに示される
- [ ] #3 Work ID に紐づく履歴と root 依存の状態が区別されている
- [ ] #4 無関係な root へ除外の意図が漏れない
<!-- AC:END -->
