---
id: TASK-523
title: テストが一時ディレクトリを /tmp に残さないようにする
status: To Do
assignee: []
created_date: '2026-11-24 05:10'
labels:
  - test
dependencies: []
priority: low
ordinal: 642000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server のテストが mkdtempSync で作った一時ディレクトリを後始末していない。2026-11-24 時点の /tmp に mimimilli-static-* 5195個、mimimilli-origin-* 744個、mimimilli-static-no-index-* 743個、mimimilli-settings-route-* 740個、mimimilli-static-outside-* 371個、mimimilli-sample-library-* 364個、works-query-contract-* 268個、condition-contract-* 158個が残っていた（例: server/tests/requestOrigin.test.ts の「静的配信にもHost検証が効く」は finally で app.shutdown() だけして dir を消していない）。TASK-520 の調査中に発見。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pnpm test を1回流す前後で /tmp 直下の mimimilli-*・works-query-contract-*・condition-contract-* の数が増えない
- [ ] #2 一時ディレクトリの作成と後始末が共通の仕組みに寄っていて、テストごとに rmSync を書き忘れる形になっていない
<!-- AC:END -->
