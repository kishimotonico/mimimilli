---
id: TASK-255
title: Bun並列serverテストの停止を解消する
status: Done
assignee:
  - '@codex'
created_date: '2026-08-08 12:26'
updated_date: '2026-08-08 12:42'
labels: []
dependencies: []
references:
  - server/package.json
  - backlog/tasks/task-224 - ローカル検証ループを高速化する（tsc-incremental・check並列化・テスト並列化）.md
priority: medium
ordinal: 265000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`pnpm test` が client 完了後も server の `bun test tests --parallel` でテストケースを出力せず停止する。TASK-209 の検証時、専用worktreeと master checkout の双方で5〜10分待っても進展しなかった。一方、`server/` で `bun test tests` を非並列実行すると63 files / 524 testsが17.002秒で全件成功した。TASK-224完了時には同じ並列設定で505件が8〜9.6秒で成功しており、その後に生じた回帰またはBun 1.3.14の並列worker終了問題と考えられる。固定DB・一時ファイル・worker/handle未解放・Bunの並列IPCを切り分け、標準の検証コマンドを安定して完了させる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `pnpm --filter @mimimilli/server test` が現在の全serverテストを完走し、終了コード0になる
- [x] #2 `pnpm test` がserver/clientの両方を完走し、終了コード0になる
- [x] #3 停止原因がテスト間共有資源なら隔離し、Bun側の問題なら安定する並列度または実行方式へ変更する
- [x] #4 並列実行を維持する場合、同じコマンドを連続2回実行して再発しない
- [x] #5 pnpm checkが通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. TASK-224完了後に追加・変更されたserverテストを中心に、並列実行をファイル集合で二分して停止を再現する最小集合を特定する。
2. 固定DB・一時ディレクトリ・Worker・共有handle・Bun並列IPCのどれが停止原因か、非並列成功との差から確定する。
3. テスト隔離の不足なら対象テストを修正する。Bun 1.3.14のrunner問題なら、速度を保ちつつ安定する明示的並列度または実行方式へserver test scriptを変更する。
4. server testを連続2回、root pnpm test、pnpm checkで検証する。
5. ACを更新し、原因・変更・実測を記録してコミットする。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
複数 worker の最小再現として、共有DB・Workerを使わない dlsiteTitle.test.ts と real/dataRoot.test.ts の2ファイルでも bun test --parallel=2/3 がテスト出力前に20秒で停止。--parallel=1 と非並列は全524件成功したため、server test を非並列へ戻した。

原因: Bun 1.3.14 の複数test worker。共有資源を使わない2ファイルでも --parallel=2/3 が開始前に停止し、--parallel=1 と非並列は成功したため、server testを逐次実行へ戻した。検証: server 63 files / 524 testsを2回連続成功（16.62秒、17.20秒）、root pnpm testでserver 524件・client 777件成功（28.41秒）、pnpm check成功（4.51秒）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bun 1.3.14の複数workerでserverテストが開始前に停止するため、serverの標準test scriptを逐次実行へ戻した。全524件を2回連続、rootの全1301件、pnpm checkで検証した。
<!-- SECTION:FINAL_SUMMARY:END -->
