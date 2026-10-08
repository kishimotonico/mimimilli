---
id: TASK-499
title: 作品登録エラーのnot_configuredをパス不正と未設定で分ける
status: Done
assignee:
  - '@mimi2'
created_date: '2026-10-02 11:49'
updated_date: '2026-10-08 04:12'
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
- [x] #1 パスが存在しない・root配下でない場合の登録エラーが、未設定とは別のコードで返る
- [x] #2 rootが未設定のときの登録エラーが他のAPIと同じステータスになる
- [x] #3 WorkRegisterErrorのコードの型が1箇所で定義されている
- [x] #4 clientの表示が新しいコードに追従している
- [x] #5 pnpm check && pnpm test が通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
パス不正を invalid_path（404）として分け、root 未設定は NotConfiguredError（409）に。WorkRegisterErrorCode を1回だけ定義。client はステータスとメッセージだけを見ているため追従不要。 個別レビュー＋統合ブランチの横断レビュー、feat/audit-sweep 先端で pnpm check・test 全通過、smoke 29/30（失敗1件は別プロジェクトの vite とのポート衝突で、単体再実行3/3通過）。17736da3 で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
