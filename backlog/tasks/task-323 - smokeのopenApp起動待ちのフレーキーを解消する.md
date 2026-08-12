---
id: TASK-323
title: smokeのopenApp起動待ちのフレーキーを解消する
status: To Do
assignee: []
created_date: '2026-08-12 17:43'
labels: []
dependencies: []
ordinal: 333000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
フルスイート実行時に client/tests/smoke/support.ts の openApp が .mle-col.is-axis の可視待ちで20秒タイムアウトすることがある。単体実行では3.1秒、再実行では1.7秒で成功するため実装の不具合ではなく、フルスイート実行時の起動タイミングに起因する一過性の失敗。timeoutを伸ばすのではなく、待機対象を確定的な状態にするか起動処理側のボトルネックを特定して解消する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 smokeフルスイートを3回連続実行してopenAppのタイムアウトが発生しない
- [ ] #2 待機条件がtimeout延長ではなく確定的な状態の待機になっている
<!-- AC:END -->
