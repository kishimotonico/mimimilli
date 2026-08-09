---
id: TASK-273
title: core↔SQL二重実装のADR-0004/0008適合を監査しDLsite通知の扱いを決める
status: Done
assignee: []
created_date: '2026-08-08 21:20'
updated_date: '2026-08-09 01:34'
labels: []
dependencies: []
priority: medium
ordinal: 283000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexレビュー反映で再定義。当初「二重実装の扱いを設計として確定する」としたが、これは既決事項だった: ADR-0004（core-functions-over-sql）とADR-0008が「coreが仕様正本、realはSQL実行、fixtureはcore参照実装、契約テストで同値担保」を決定済み。再審議はしない。

統括・ユーザー協議で確定済みの方針（2026-08-09）:
- 規範は smartFolder 型（core単一実装をfixture/real両方が呼ぶ）。新機能のデフォルトはcore-first
- SQL二重実装は性能例外としてのみ許可し、契約テスト必須。現行の例外は worksQuery と axisFacets の2つだけと閉じる
- DLsite通知の集計はcore純関数化してfixtureが呼ぶ形へ寄せる（realはSQL維持+既存 dlsiteNotifications.test.ts で同値担保。実装はTASK-262へ統合または小タスク起票）
- fixtureはViteのdev middleware（Node）とBunサーバーの両方で動くため bun:sqlite に依存できない。SQLへの一本化・ランタイム統一（Vite-on-Bun等）は今回のリファクタのスコープ外とし、配布タスク本格化時に別ADRで見直す

残作業:
- 現状コードのADR-0004/0008への適合状況を監査する（定数・正規化ロジックのコメント頼み同期、契約テストのカバレッジ漏れ等の逸脱を列挙）
- 上記確定方針をADR-0004への追記（または0008の補足）として文書化する
- 逸脱への対応はADR追記または実装タスク起票で記録する
- draft-50（ビュー軸とスマートフォルダーの評価経路統合）との関係も整理する
実施順の制約: ADR-0008を触るためTASK-261と同一セッションで順次実施する。TASK-269・272の物理分割より先に行う。本タスクは委任せず統括がユーザーと対話して確定する（方針協議は完了、監査と文書化が残り）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 DLsite通知集計の core純関数化の要否が決定されていること
- [x] #2 決定に伴う実装タスクが起票されていること
- [x] #3 ADR-0004/0008の既決定に対する現状の適合状況が監査され、逸脱と対応（ADR追記または起票）が記録されていること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
監査結果（ADR-0008 A〜H）。適合: ソートキー一元化（japaneseSortKey.ts:4-14 がNFKC→カタカナ折りたたみ→toLowerCase、title_sort_key等の派生列にCOLLATE BINARYで保存）／randomのseed契約（実装済み、4xx退避ではない）／全順序（core・SQLとも全SortIdでwork_id ASCが最終タイブレーカー）／user孤児行の起動時整合性検査（db.ts:216-227）／スキーマ正本（Drizzle sqliteTableが唯一）。契約テストはADR-0008が挙げる6項目のうち4項目適合、2項目が部分適合（bookmarked等の全組み合わせがモジュロ分散止まり、limit上限500付近の境界が未テスト）。逸脱と対応: (1)DLsite通知述語がSQLで無言再実装 → 例外として追認せずcore化、TASK-262へ統合。(2)RECENT_VIEW_WINDOW_DAYS=30がcore/worksQuery.ts:18とworkRepo.ts:165で無言重複 → TASK-262（sharedへ1箇所化）に既出。(3)RJ正規化CASE・randomローテーション等のSQL断片に相互参照コメントが無い → TASK-269のworkQuerySql.ts一本化に既出。(4)軸値ソートがサーバー（compareJapaneseSortKeys）とクライアント（localeCompare）で不一致 → TASK-277へ統合。(5)ファイル名ソートのlocaleCompareはADR適用範囲外と判断しADRに明記。監査で見つかった再実装を機械的に例外へ追加するとcore-first規範が骨抜きになるため、内訳フラグメント／core化対象／独立例外の3分類で整理し、独立例外は該当なしと判定した。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ADR-0008へ「core↔SQL二重実装の統制」節を追記し、認可済みSQL例外を worksQuery と axisFacets の2件に閉じた。各例外の経路・性能理由・契約テストを明記し、例外追加には性能理由と契約テストの2条件とADR改訂を必須とした。監査で見つかった5件は内訳フラグメント／core化対象／独立例外に分類し、独立例外は該当なし。DLsite通知述語のcore化はTASK-262、SQL断片の一本化はTASK-269、軸値ソート不一致はTASK-277へ統合した。
<!-- SECTION:FINAL_SUMMARY:END -->
