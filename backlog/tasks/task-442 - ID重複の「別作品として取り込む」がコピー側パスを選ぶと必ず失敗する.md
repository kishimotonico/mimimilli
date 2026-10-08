---
id: TASK-442
title: fixtureのID重複解消がコピー側パスを選ぶと失敗する
status: To Do
assignee: []
created_date: '2026-09-09 15:32'
updated_date: '2026-10-08 03:39'
labels:
  - bug
  - scan
dependencies: []
priority: medium
ordinal: 463000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-435 の検証中に発見。realの reassignIdentityConflict（server/src/adapters/real/workMethods.ts）は診断のpathsに含まれるパスなら登録側・コピー側どちらでも再採番でき、コピー側は server/tests/workPlacementContract.test.ts で縛られている。fixtureの reassignIdentityConflict（server/src/adapters/fixture/works.ts）だけが work.physicalPath との一致を要求するため、new-workシナリオでコピー側 copies/RJ501001_... を選ぶと null で失敗する。UIは両パスに再採番導線を出すので、fixture上ではrealと違って失敗する。TASK-472（単一ファイル形式メタのFiles導線）と同じfixture関数を触るため、472と同じバッチで472の後に着手する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 fixtureの reassignIdentityConflict が、診断のpathsに含まれるコピー側パスでもrealと同じ意味で再採番できる
- [ ] #2 登録側・コピー側の両パスの再採番が、fixtureとrealの両adapterを通るテストで縛られている
- [ ] #3 pnpm check && pnpm test が通る
<!-- AC:END -->
