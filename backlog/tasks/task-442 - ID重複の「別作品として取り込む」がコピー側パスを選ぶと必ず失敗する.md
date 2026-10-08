---
id: TASK-442
title: fixtureのID重複解消がコピー側パスを選ぶと失敗する
status: Done
assignee:
  - '@mimi2'
created_date: '2026-09-09 15:32'
updated_date: '2026-10-08 05:32'
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
- [x] #1 fixtureの reassignIdentityConflict が、診断のpathsに含まれるコピー側パスでもrealと同じ意味で再採番できる
- [x] #2 登録側・コピー側の両パスの再採番が、fixtureとrealの両adapterを通るテストで縛られている
- [x] #3 pnpm check && pnpm test が通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
fixture の reassignIdentityConflict を、診断の paths に含まれるパスなら登録側・コピー側どちらでも再採番できる real の意味に揃え、両 adapter の契約テストで縛った。 個別レビュー＋統合ブランチの横断レビュー、master への仮マージ（衝突解消込み）で pnpm check・test（server 953 / client 1247）・smoke 30 全通過。15013618 で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
