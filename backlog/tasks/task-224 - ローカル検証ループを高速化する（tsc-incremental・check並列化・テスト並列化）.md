---
id: TASK-224
title: ローカル検証ループを高速化する（tsc incremental・check並列化・テスト並列化）
status: To Do
assignee: []
created_date: '2026-08-07 07:16'
updated_date: '2026-08-07 07:21'
labels: []
dependencies: []
priority: medium
ordinal: 234000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
speed-scout実測調査（2026-08-07）に基づくローカルループの実行時間短縮。(1) tscのincremental化: .gitignoreに*.tsbuildinfoが既にあるのに全tsconfigでincremental未設定。有効化でウォーム実行がserver 4.8s→1.66s、client 4.7s→1.4s。(2) pnpm checkの並列化: shared→server→clientのtscを&&逐次実行しており15.2s。3つのtsconfigは独立しており並列で8.6sを実測済み。(3) serverテストにbun test --parallel追加: 18.2s→8〜9.6s、505テスト全pass2回確認済み。ただし固定DBパス・固定ポートを使うテストがないか導入時に確認する。(4) root pnpm testの並列化: CPUコア競合でウォール時間の短縮は小さい（合計18s程度）が、テスト同士は独立で害がないため設定しておく。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 shared/server/clientのtsconfigでincrementalが有効になり、tsBuildInfoFileの出力先がgitignoreされる場所に設定されている
- [x] #2 pnpm checkがtsc3つ・lint・fmt:checkを並列実行し、失敗時はどの工程が失敗したか判別でき、終了コードが正しく非0になる
- [x] #3 server testが--parallelで実行され、全テストがpassする（固定パス・固定ポート依存のテストがないことを確認済み）
- [x] #4 root pnpm testがserver/clientを並列実行し、失敗が正しく伝搬する
- [x] #5 pnpm checkとpnpm testの全体が通る
<!-- AC:END -->
