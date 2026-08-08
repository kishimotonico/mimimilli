---
id: TASK-255
title: Bun並列serverテストの停止を解消する
status: To Do
assignee: []
created_date: '2026-08-08 12:26'
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
- [ ] #1 `pnpm --filter @mimimilli/server test` が現在の全serverテストを完走し、終了コード0になる
- [ ] #2 `pnpm test` がserver/clientの両方を完走し、終了コード0になる
- [ ] #3 停止原因がテスト間共有資源なら隔離し、Bun側の問題なら安定する並列度または実行方式へ変更する
- [ ] #4 並列実行を維持する場合、同じコマンドを連続2回実行して再発しない
- [ ] #5 pnpm checkが通る
<!-- AC:END -->
