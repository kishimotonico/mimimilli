---
id: TASK-499
title: 作品登録エラーのnot_configuredをパス不正と未設定で分ける
status: To Do
assignee: []
created_date: '2026-10-02 11:49'
labels:
  - server
  - refactor
dependencies: []
documentation:
  - backlog/docs/doc-6
priority: low
ordinal: 557000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
WorkRegisterError の code のうち not_configured が、rootが未設定の場合だけでなく「パスが存在しない」「root配下でない」場合にも使われ、works.ts では404に写る。一方 NotConfiguredError は app.onError で409に写るため、同じ語が別の意味・別のステータスで使われている。WorkRegisterError の code のunionも errors.ts のフィールドとコンストラクタ引数で二重に書かれている。パス不正には専用のコードを用意し、unionは1回だけ定義する。エラー→HTTPの写像を一元化する表を作るのは、エラー種別が増えたときに判断する。詳細は doc-6 の srv-arch-7。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 パスが存在しない・root配下でない場合の登録エラーが、未設定とは別のコードで返る
- [ ] #2 rootが未設定のときの登録エラーが他のAPIと同じステータスになる
- [ ] #3 WorkRegisterErrorのコードの型が1箇所で定義されている
- [ ] #4 clientの表示が新しいコードに追従している
- [ ] #5 pnpm check && pnpm test が通る
<!-- AC:END -->
