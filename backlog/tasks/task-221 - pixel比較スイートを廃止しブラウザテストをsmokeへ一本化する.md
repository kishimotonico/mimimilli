---
id: TASK-221
title: pixel比較スイートを廃止しブラウザテストをsmokeへ一本化する
status: Done
assignee:
  - '@impl-221'
created_date: '2026-08-07 01:40'
updated_date: '2026-08-07 01:57'
labels: []
dependencies: []
priority: high
ordinal: 231000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
テスト戦略の変更（2026-08-07ユーザー承認、Codex・Fableのセカンドオピニオン反映済み）。最終確認は目視方針のためpixel比較は二重の網であり、ベースライン維持コストの実績（常に赤くなり実害バグが埋もれた事故）に見合わない。全廃してsmoke（roleベースの動作検証）へ一本化する。廃止はgit履歴で可逆。あわせてセカンドオピニオンの指摘を反映しsmokeを強化する: (a) pixel側が担っていた機能検証をsmokeへ移管、(b) pageerror/requestfailed収集、(c) レイアウト全損ガード（横方向overflow不在）を1本追加、(d) retry無効化（再実行で通る失敗を隠さない）、(e) classセレクタ依存をroleベースへ寄せる（CSSリファクタで赤の信頼が壊れるのを防ぐ）。運用面の変更（smokeはタスク完了時に常時実行）はAGENTS.mdの管轄だが、AGENTS.mdは別作業が進行中のため本タスクでは触らない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 library.visual.spec.tsとスナップショットPNG・test:visual:updateスクリプトが削除されている
- [x] #2 コマンドがtest:smokeへ改名され、root/clientのpackage.jsonとdocs（HANDOFF等、AGENTS.mdを除く）の参照が更新されている
- [x] #3 pixel側が担っていた機能検証（欠損状態・階層タグ表示・grid切替・複合絞り込み等、現行スペックを確認して特定）がsmokeで検証されている
- [x] #4 smokeにpageerror/requestfailedの検出と横方向overflow不在のガードが追加されている
- [x] #5 smokeのretriesが0になり、classセレクタ依存の箇所がroleベースへ置き換わっている
- [x] #6 CI=1でのsmoke全件passが3連続で確認されている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装報告（impl-221）: visual spec＋PNG6枚削除、tests/visual→tests/smoke改名、test:smokeへコマンド改名（root/client/README/HANDOFF/design-system）、retries0化、pageerror/requestfailed収集追加（TanStack Queryの正常な中断net::ERR_ABORTEDは除外）、横overflowガード追加、旧visualの機能検証4件をroleベースで移管（missing file表示・grid切替・階層表示・軸またぎAND）。セレクタrole化はbutton/option系を置換、素のdivコンテナ（.mle-col等）はrole未実装のため現状維持。検証中に自作バグ2件（ERR_ABORTED誤検出、画面遷移仕様を無視したテスト設計）を自力で特定・修正。CI=1で3連続10件pass（25〜26s/回）、tsc/lint/fmt通過。

レビュー（review-221）: 指摘1件のみ — AGENTS.md:30に削除済みコマンドpnpm test:visualの記述が残る。AGENTS.mdは別エージェント作業中のため本タスクでは触らず、運用文言の変更（smokeはタスク完了時に常時実行）と合わせて後日1回で更新する残件とした。他は全観点問題なし（ERR_ABORTED除外は完全一致判定で妥当、旧visual 6テストの検証は4件移管＋2件は既存smokeに包含、docs書き換えに余分な改変なし）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
pixel比較スイートを全廃しsmokeへ一本化。tests/visual→tests/smoke改名、test:smokeへコマンド改名、retries0化、pageerror/requestfailed検出（正常中断ERR_ABORTEDは除外）、横overflowガード追加、旧visualの機能検証をroleベースで移管。CI=1で3連続10件pass（25〜26s/回）、tsc/lint/fmt通過。Codex・Fableのセカンドオピニオンを反映した設計。Sonnetレビュー済み、コミット790dcaa、masterへマージ済み。残件: AGENTS.mdの運用文言更新（別作業完了後）。
<!-- SECTION:FINAL_SUMMARY:END -->
