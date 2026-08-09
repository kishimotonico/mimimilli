---
id: TASK-283
title: clientのテストを型チェック対象に含める
status: To Do
assignee: []
created_date: '2026-08-09 15:08'
labels: []
dependencies: []
ordinal: 293000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/tsconfig.json の include が "src" のみで、client/tests/ 配下が tsc の対象外になっている。pnpm check（tsc）はテストコードの型崩れを一切検出しない。

TASK-212 で型テストを書く際に判明した。テストが型チェックされないため、型レベルの契約を検証するテストをテストディレクトリに置けず、やむを得ず client/src/shared/api/http.type-test.ts（どこからも import されないファイル）を src 配下へ置いて tsc に拾わせている。TASK-268 でデッドコード削除を進めた直後でもあり、未参照ファイルが src に居座るのは望ましくない。

tests/ を include に加えると既存の型エラーが多数出ると報告されている（規模は未計測）。エラーを潰したうえで include へ加え、http.type-test.ts は tests/ 配下へ移すこと。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 client/tests/ が tsc の対象に含まれ、pnpm check がテストコードの型エラーを検出する
- [ ] #2 既存の型エラーが解消されている（テストの意図を変えずに直すこと。型エラーを握りつぶす any や ts-ignore を足さない）
- [ ] #3 client/src/shared/api/http.type-test.ts が tests/ 配下へ移動し、src に未参照ファイルが残っていない
- [ ] #4 pnpm check と pnpm test が通る
<!-- AC:END -->
