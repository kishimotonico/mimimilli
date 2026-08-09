---
id: TASK-273
title: core↔SQL二重実装のADR-0004/0008適合を監査しDLsite通知の扱いを決める
status: To Do
assignee: []
created_date: '2026-08-08 21:20'
updated_date: '2026-08-09 00:29'
labels: []
dependencies: []
priority: medium
ordinal: 283000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexレビュー反映で再定義。当初「二重実装の扱いを設計として確定する」としたが、これは既決事項だった: ADR-0004（core-functions-over-sql）とADR-0008が「coreが仕様正本、realはSQL実行、fixtureはcore参照実装、契約テストで同値担保」を決定済み。再審議はしない。
やること:
- 現状コードのADR-0004/0008への適合状況を監査する（定数・正規化ロジックのコメント頼み同期、契約テストのカバレッジ漏れ等の逸脱を列挙）
- 未決事項を確定する: DLsite通知の集計（fixture=in-memory filter / real=SQL、dlsiteNotifications.test.ts が同値検証）を同じ規則（core純関数化してfixtureが呼ぶ）に含めるかどうか
- 逸脱への対応はADR追記または実装タスク起票で記録する
- draft-50（ビュー軸とスマートフォルダーの評価経路統合）との関係も整理する
実施順の制約: ADR-0008を触るためTASK-261と同一セッションで順次実施する。TASK-269・272の物理分割より先に行う（正本の確認前に構造を固定しない）。本タスクは委任せず統括がユーザーと対話して確定する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 DLsite通知集計の core純関数化の要否が決定されていること
- [ ] #2 決定に伴う実装タスクが起票されていること
- [ ] #3 ADR-0004/0008の既決定に対する現状の適合状況が監査され、逸脱と対応（ADR追記または起票）が記録されていること
<!-- AC:END -->
