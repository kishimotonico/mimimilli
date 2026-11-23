---
id: TASK-517.2
title: スマートフォルダーの更新と作成の口を単純にする
status: Done
assignee: []
created_date: '2026-11-23 12:49'
updated_date: '2026-11-23 13:48'
labels:
  - server
  - shared
dependencies:
  - TASK-517.3
parent_task_id: TASK-517
priority: high
ordinal: 625000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
列ごとの PUT（/condition・/sort・/group-sort）と PUT /:id を PATCH /smart-folders/:id の部分更新1本にする。削除の取り消しと「既定から追加」を作成の口に寄せる。サーバーが守るのはデータの不変条件だけにし、既定の ID による権限をなくす（権限は「すべて」だけの2段）。ADR-0040 の HTTP の契約に従う。新しいエラー文言には総称「スマートフォルダー」を出さない。migration 0007 から INSERT を消してよい（実行器は created_at だけを突き合わせ、hash は比べない）。design-system.md の「同じ ID・位置・作成日時のまま戻す」（225行付近）も直す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 「すべて」の定義が起動時の初期化1か所にあり、migration の INSERT と一致を確かめるテストが無い
- [x] #2 更新が PATCH /smart-folders/:id 1本で、送った列だけが更新される
- [x] #3 作成と更新のどちらも、できあがる行を shared の同じ1関数が検証する（保存できる条件の形、groupBy と groupSort の組、「すべて」の形）。違反は 400
- [x] #4 既定の ID による 403 と、テンプレートの定義との一致の検査が無い
- [x] #5 削除の取り消しと「既定から追加」が POST /smart-folders を通り、id（形式 ^[a-z0-9-]{1,64}$ だけを検査）と position を受け、既存の ID は 409 になる
- [x] #6 条件の木の子とチップは各100個までで、超えた木と1段より深い入れ子（2万段を含む）は 400 になる
- [x] #7 client の更新・作成・並べ替えの本文が shared の要求型を通り、使われない要求型が残っていない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
517.3 からの引き継ぎ（統括）: (1) 517.3 の読めない行の文言（server/src/errors.ts:52、ADR-0040:226）が「消した『すべて』は次の起動で戻ります」と案内している。AC#1 の起動時の初期化で、id='all' を消して起動し直すと「すべて」が戻ることを実際にテストで確かめる。(2) 作成と更新を検証する shared の1関数（AC#3）を、読み出しの検証にも通す。DB を手で書き換えて「すべて」の sort が null になった行も、読めない行として 500 で案内されるようにする（今は client の resolveLibraryView が描画中に throw する）。

PATCH 1本・POST への寄せ・shared の smartFolderViolation 1本（作成・更新・読み出し）・起動時の「すべて」初期化・上限。常駐レビューで PATCH の検証と書き込みの分離（交差で読めない行ができる）を指摘され、adapter の1トランザクションに移した。交差を起こせていない Promise.all のテストは消した。shared の smartFolderPermissions は 517.4 で画面とともに直す。
<!-- SECTION:NOTES:END -->
