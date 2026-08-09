---
id: TASK-273
title: core↔SQL二重実装のADR-0004/0008適合を監査しDLsite通知の扱いを決める
status: To Do
assignee: []
created_date: '2026-08-08 21:20'
updated_date: '2026-08-09 00:48'
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
- [ ] #1 DLsite通知集計の core純関数化の要否が決定されていること
- [ ] #2 決定に伴う実装タスクが起票されていること
- [ ] #3 ADR-0004/0008の既決定に対する現状の適合状況が監査され、逸脱と対応（ADR追記または起票）が記録されていること
<!-- AC:END -->
