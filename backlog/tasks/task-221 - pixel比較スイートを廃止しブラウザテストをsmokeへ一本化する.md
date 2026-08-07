---
id: TASK-221
title: pixel比較スイートを廃止しブラウザテストをsmokeへ一本化する
status: To Do
assignee: []
created_date: '2026-08-07 01:40'
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
- [ ] #1 library.visual.spec.tsとスナップショットPNG・test:visual:updateスクリプトが削除されている
- [ ] #2 コマンドがtest:smokeへ改名され、root/clientのpackage.jsonとdocs（HANDOFF等、AGENTS.mdを除く）の参照が更新されている
- [ ] #3 pixel側が担っていた機能検証（欠損状態・階層タグ表示・grid切替・複合絞り込み等、現行スペックを確認して特定）がsmokeで検証されている
- [ ] #4 smokeにpageerror/requestfailedの検出と横方向overflow不在のガードが追加されている
- [ ] #5 smokeのretriesが0になり、classセレクタ依存の箇所がroleベースへ置き換わっている
- [ ] #6 CI=1でのsmoke全件passが3連続で確認されている
<!-- AC:END -->
