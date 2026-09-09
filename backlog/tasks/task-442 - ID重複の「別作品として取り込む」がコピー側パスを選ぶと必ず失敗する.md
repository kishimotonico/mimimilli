---
id: TASK-442
title: ID重複の「別作品として取り込む」がコピー側パスを選ぶと必ず失敗する
status: To Do
assignee: []
created_date: '2026-09-09 15:32'
labels:
  - bug
  - scan
dependencies: []
priority: medium
ordinal: 463000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-435 の検証中に発見。

identityConflicts の解消操作 reassignIdentityConflict は、指定されたパスが work.physicalPath と一致する場合しか成功しない。ID重複は「同一作品が2箇所にある」状態なので、work エンティティを1つしか持たず、登録済みの実体でないほう（コピー側）のパスを選ぶと必ず失敗する。

実測で確認済み（TASK-435 の実装担当が createFixtureAdapter({scenario:"new-work"}) 経由で2パターン実行）:

  before: [{"workId":"RJ501001","paths":["dlsite/夜想曲スタジオ/RJ501001_夜更けの図書室で囁き朗読","copies/RJ501001_夜更けの図書室で囁き朗読"]}]
  canonical path reassign result: success(non-null)
  copies path reassign result: null(failure)

UI 上は両方のパスに対して「別作品として取り込む」が提示されるため、ユーザーはコピー側を選べてしまい、無言で失敗する。どちらのパスを選んでも意図どおりに取り込めるようにするか、選べないようにするかの設計判断が要る。

TASK-435 の「Filesで開く」導線の404修正（fixture のデータ不整合）とは別の、本番でも起きる機能上の問題。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ID重複の解消操作で、コピー側パスを選んだときの挙動が仕様として定義されている（取り込めるようにするか、選べないようにするか）
- [ ] #2 無言で失敗せず、失敗する場合は理由がユーザーに伝わる
- [ ] #3 fixture の new-work シナリオで両方のパスについて実機確認できる
<!-- AC:END -->
