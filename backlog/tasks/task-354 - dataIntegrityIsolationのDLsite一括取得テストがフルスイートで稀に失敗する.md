---
id: TASK-354
title: dataIntegrityIsolationのDLsite一括取得テストがフルスイートで稀に失敗する
status: To Do
assignee: []
created_date: '2026-08-18 04:07'
labels: []
dependencies: []
ordinal: 364000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server/tests/real/dataIntegrityIsolation.test.ts:164「DLsite 一括取得は壊れた作品を除外し dataIntegrityWarning を返す」が、ルートの pnpm test（run-p でserver/clientを同時実行）で稀に失敗する。

## 実測（統括、2026-08-18）

- TASK-353のworktree（master + テストペイロード縮小のみ）で pnpm test 10回中1回失敗（130.84ms で fail）
- master で pnpm test 8回中0回
- 単体実行（bun test tests/real/dataIntegrityIsolation.test.ts）をCPU負荷下（yes 8本並走）で master 15回・353worktree 15回、いずれも失敗0

**フルスイート実行時のみ**再現し、単体では負荷をかけても再現しない。他テストとの相互作用が疑われる。

## 帰属

未確定。TASK-353の変更はdlsiteCache.test.tsのテストペイロードを8MBから64KBへ縮小しただけで、本テストとは無関係に見える。ただし実行時間が変わることで並列実行のタイミングが変わり、元からあった相互作用が露出した可能性は否定できない。サンプル数が少なく（1/10 対 0/8）統計的な差とは言えない。

## 進め方

まず失敗時の実際のアサーション内容を取得する（130msで失敗しているのでタイムアウトではなく、アサーション不一致か例外）。フルスイートでのみ出るため、失敗するまで pnpm test を回して出力を捕捉する必要がある。

再現したら、どのテストとの相互作用かを切り分ける。同一プロセスで走る他テストの副作用（グローバルオブジェクトの差し替え、共有ディレクトリ、環境変数など）を疑う。TASK-339では @hono/node-server の getRequestListener が overrideGlobalObjects 既定trueで global.Response をプロセス全体で差し替え、同一プロセスの他テストを壊していた実績がある。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 失敗時の実際のアサーション内容・エラーが取得され、タスクnotesに記録されている
- [ ] #2 失敗の原因（どのテストとの相互作用か、または単独の問題か）が特定されている
- [ ] #3 原因構造が修正され、ルートのpnpm testを15回連続実行して当該テストが失敗しない
<!-- AC:END -->
