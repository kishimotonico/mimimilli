---
id: TASK-354
title: dataIntegrityIsolationのDLsite一括取得テストがフルスイートで稀に失敗する
status: Done
assignee: []
created_date: '2026-08-18 04:07'
updated_date: '2026-08-18 04:37'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
統括による帰属確定と再現試行（2026-08-18）:

発生率の実測
- master 2c7007b（TASK-353マージ後、現行）: フルスイート pnpm test 30回連続、失敗0
- 同 master、CPU負荷下（yes 8本並走、nproc=12）: 15回連続、失敗0
- 参考（起票時）: 353のworktree 10回中1回、353マージ前master 8回中0回
- 単体（bun test tests/real/dataIntegrityIsolation.test.ts）をCPU負荷下で30回（master 15・353worktree 15）: 失敗0

合計48回中1回のみの観測。当初の1/10という印象より実際の発生率はかなり低い。TASK-353への帰属は否定される（353はmasterへマージ済みで、その状態で45回失敗0）。

静的調査（TASK-339型の相互作用の有無）
- getRequestListener / overrideGlobalObjects / globalThis.fetch|Response|Request への代入 / stubGlobal を server/src・server/tests 全文検索 → ヒット0
- テスト内での process.env 書き換え → ヒット0

TASK-339で実在した『同一プロセス内でグローバルオブジェクトを差し替えて他テストを壊す』パターンは、現在のserver配下には存在しない。

未取得の情報
起票のきっかけになった1回の失敗出力を保存していなかった（失敗テスト名と所要130.84msのみ）。130msでの失敗なのでタイムアウトではなくアサーション不一致か例外だが、どのアサーションが落ちたかは不明。以後の計測では失敗回の出力を丸ごと保存する運用にしている。

結論: 対応なしでクローズ（統括判断、依頼元承認済み）。

判断根拠
- 発生率は合計48回中1回。TASK-353マージ後のmaster 2c7007b では45回連続（通常30回＋CPU負荷下15回）で失敗0
- TASK-353への帰属は否定される（353はmasterへマージ済みで、その状態で再現せず）
- TASK-339で実在した『同一プロセス内でグローバルオブジェクトを差し替えて他テストを壊す』パターンは、静的調査でヒット0（getRequestListener / overrideGlobalObjects / globalThis.fetch|Response|Request への代入 / stubGlobal / テスト内のprocess.env書き換え、いずれもserver/src・server/testsに存在しない）
- ここから統計的に『起きない』と言うにはさらに140回以上（約2時間）必要で、期待値に見合わない

未取得の情報（記録として残す）
起票のきっかけになった1回の失敗出力を保存していなかった。失敗テスト名と所要130.84msのみで、どのアサーションが落ちたかは不明。130msでの失敗なのでタイムアウトではなくアサーション不一致か例外。この情報があれば結論が変わった可能性がある。

再発時の手順（再オープン条件）
同テストが再び落ちたら、次を保存したうえで本タスクを再オープンする。
1. 失敗回の全出力（どのアサーションがどんな値で落ちたか）
2. 同一実行内で走った他テストの並び（同一プロセスに同居したテストファイル）
3. 実行条件（pnpm test か bun test か、並行負荷の有無）

恒常的な仕組み化（テストランナーの出力保存整備）は、この発生率に対して過剰なため今回は行わない。
<!-- SECTION:NOTES:END -->
