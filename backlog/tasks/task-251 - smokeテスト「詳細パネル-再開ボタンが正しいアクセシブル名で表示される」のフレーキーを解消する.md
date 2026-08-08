---
id: TASK-251
title: 'smokeテスト「詳細パネル: 再開ボタンが正しいアクセシブル名で表示される」のフレーキーを解消する'
status: To Do
assignee: []
created_date: '2026-08-08 08:49'
labels: []
dependencies: []
ordinal: 261000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-248の検証中に pnpm test:smoke のフルスイートで1件失敗した。単体で再実行すると成功する（3.9s）ため、フィクスチャ状態の共有に起因するフレーキーと判断した。

失敗内容: getByText("夜更けの図書室で囁き朗読").click() が30秒でタイムアウト。テスト自体は resume API の状態とタイトルテキストの検索で、ポップオーバーや位置決めとは無関係。TASK-248由来のregressionではない。

フルスイートでは依然として赤くなり得るため、原因（前のテストが残す状態か、フィクスチャサーバーの応答か）を特定して解消する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 フルスイートの pnpm test:smoke を連続3回実行して当該テストが安定して通る
- [ ] #2 フレーキーの原因（共有状態かタイミングか）が特定されタスクのnotesに記録されている
<!-- AC:END -->
