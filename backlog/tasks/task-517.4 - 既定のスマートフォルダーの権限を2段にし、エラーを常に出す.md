---
id: TASK-517.4
title: 既定のスマートフォルダーの権限を2段にし、エラーを常に出す
status: To Do
assignee: []
created_date: '2026-11-23 12:49'
labels:
  - library
  - shared
  - client
dependencies: []
parent_task_id: TASK-517
priority: medium
ordinal: 627000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
特別扱いは「すべて」だけにする（削除・改名・条件・グループ分けは不可、並びは必須）。ほかの既定のスマートフォルダーは自作と同じく条件とグループ分けを変えられる。テンプレートは初期データと「既定から追加」の元でしかない。0件の「エラー」を隠す規則（needsCount・データ不整合の件数の配線・開いている間は残す・編集中は薄く）をなくし、常に出す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 「すべて」以外の既定のスマートフォルダーで、編集のダイアログから条件とグループ分けを変えて保存でき、上書きも出る
- [ ] #2 サーバーが守るのはデータの不変条件だけで、既定の ID による 403 が無い
- [ ] #3 0件の「エラー」がサイドバーに出続け、件数バッジだけが出ない
- [ ] #4 アイコンは条件の形とグループ分けから引かれ、既定の条件を変えたときに見合ったアイコンになる
<!-- AC:END -->
