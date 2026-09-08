---
id: TASK-433
title: smokeのポート導出がNodeのforbidden portに当たり得る問題を直す
status: To Do
assignee: []
created_date: '2026-09-07 15:46'
updated_date: '2026-09-08 00:51'
labels:
  - test
  - smoke
  - infra
dependencies: []
priority: medium
ordinal: 454000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-428.8 の作業中に発見。`client/tests/smoke/fixtures.ts` の derivePort は `process.cwd()` の SHA256 から決定的に Bun サーバーのポートを割り当てる。worktree のパスによっては算出結果が Node fetch の forbidden port list（SIP用の 5060/5061 など）に該当し、`TypeError: fetch failed [cause]: bad port` で smoke が必ず失敗する。

実測: worktree `.worktrees/428.8` では worker0/1 が 5060・5061 に割り当てられ、同じ2件が2回連続で同じ理由で失敗した（競合プロセスなし、コード変更とは無関係）。

パス依存で再現するため、特定の worktree だけ smoke が通らないという分かりにくい形で表面化する。導出結果が forbidden port を避けるようにする。Node の forbidden port list は仕様として公開されているので、算出後に該当したら次の候補へずらすなどの対処が考えられる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 derivePort の算出結果が Node fetch の forbidden port list を避ける
- [x] #2 forbidden port に当たるパスを模した入力で、避けた結果が返ることをテストで確認できる
- [x] #3 既存のポート導出の性質（同じパスなら同じポート、worker毎に別ポート）が維持されている
<!-- AC:END -->
