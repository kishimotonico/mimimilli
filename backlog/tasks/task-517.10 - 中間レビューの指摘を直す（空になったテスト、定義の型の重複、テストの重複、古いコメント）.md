---
id: TASK-517.10
title: 中間レビューの指摘を直す（空になったテスト、定義の型の重複、テストの重複、古いコメント）
status: Done
assignee: []
created_date: '2026-11-23 14:39'
updated_date: '2026-11-23 14:50'
labels:
  - shared
  - server
  - client
dependencies:
  - TASK-517.4
parent_task_id: TASK-517
priority: high
ordinal: 635000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fable の中間レビュー（統括の scratchpad の review-517-mid.md の2節 I1・N2・N3・N4）と、その調査担当のテストの重複・ADR 突き合わせの報告を直す。挙動は変えない。テストの重複は、網羅を shared の単体テストに寄せ、route のテストは口ごとの代表だけにする（統合ブランチの server/tests/smartFolderPolicy.test.ts・smartFolders.test.ts・smartFolderCondition.test.ts・updatePayloadContract.test.ts・real/workRepoPersistence.test.ts と real/smartFolderStorage.test.ts の重なり）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 LibrarySidebarPanel.test.tsx の「列見出しでの変更は一時状態」が PATCH /api/smart-folders/:id の0回を確かめ、消えた口・キーを見るだけのテスト（旧 PUT の 404 など）が client・server に残っていない
- [x] #2 定義の5列を抜く shared の関数が1つあり、取り消し・既定から追加・起動時の初期化・編集の下書きがそれを通る（列を手で並べた写しが無い）
- [x] #3 SmartFolderTemplate が SmartFolderWrite から作られ、client の SmartFolderDraft が無く、smartFolderSchema が definitionShape を使う
- [x] #4 fixture/state.ts・smartFolderEditing.ts・useSmartFolderEditor.ts の古いコメント（migration、権限、件数）が無く、useGroupValuesQuery.ts の null の二重の扱いが無い
- [x] #5 「すべて」の形・groupBy と groupSort の組・条件の形と上限の網羅は shared の単体テストにあり、route のテストは口ごとの代表（上限は100/101の境界と深い入れ子）だけで、同じ確認が複数のテストファイルに重なっていない
- [x] #6 parseGroupByKey に単体テストがあり、空の prefix・コロンを含む prefix・未知の kind を確かめている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
definitionOf で5列の写しを1つに、SmartFolderDraft 削除、テストの網羅を shared の単体に寄せ route は代表だけに、parseGroupByKey のテスト追加。常駐レビュー important なし、名前の trim を縛る assertion を追加。client テストの重複2件は 517.5・517.9 のメモへ。
<!-- SECTION:NOTES:END -->
