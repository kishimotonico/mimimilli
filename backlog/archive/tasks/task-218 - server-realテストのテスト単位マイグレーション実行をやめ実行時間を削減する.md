---
id: TASK-218
title: server realテストのテスト単位マイグレーション実行をやめ実行時間を削減する
status: In Progress
assignee:
  - '@impl-218'
created_date: '2026-08-06 17:26'
updated_date: '2026-08-06 17:44'
labels: []
dependencies: []
priority: high
ordinal: 228000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
実測（2026-08-07）で pnpm test のserver側18.0秒のうち tests/real/（35ファイル/288テスト）が15.7秒（87%）を占める。支配的コストはテスト内容ではなく、createTestRealAdapter がテスト1件ごとに実SQLiteマイグレーションを実行するインフラ構造（dlsite.test.ts だけで37回実行）。マイグレーション済みスキーマをプロセス内で使い回す方式（例: 一度マイグレーションしたテンプレートDBファイルを各テストへコピー、またはスキーマSQLのキャッシュ適用）へ変え、テストごとの分離は保ったまま実行時間を削減する。設計のクリーンさを最優先し、プロダクトコード側のマイグレーション実装は変えない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 テスト1件ごとのフルマイグレーション実行がなくなり、マイグレーションはプロセスあたり1回になっている
- [ ] #2 各テストは引き続き独立したDB状態で開始する（テスト間の状態漏れがない）
- [ ] #3 server全体のテスト実行時間が実測で大幅に短縮されている（目安: 18秒→8秒以下。到達できない場合は実測値と理由をnotesに記録）
- [ ] #4 bun test tests が全件通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装担当（impl-218）の実測により前提が崩れたため実装せず取り下げ。計測結果: openDb（マイグレーション込み）は全505テストで133回・累積1.36秒＝全体18.98秒の約7%に過ぎない。bun:sqliteの:memory:マイグレーションは6.7ms/回と軽量で、テンプレートDBファイルコピー方式は file-backed SQLiteのWAL設定・実I/Oコストにより倍遅い（dlsite.test.ts実測 5.14s→7.86sに悪化）。realテストが重い真因は、実ファイル・実DLsiteキャッシュ・実workerスレッド・実SQLiteロック待機を使う結合テスト自体の実行コスト（上位9件で約6.7秒=40%）。統括判断: serialize/deserialize方式でも最大1.3秒しか稼げずROI不成立。新運用ルール（フルスイートはタスク完了時1回のみ）の下でserver約19秒は許容範囲のため、重い結合テストの削減も見送り。worktreeはクリーン（server/src・テスト共に無変更）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
実測により「テスト単位マイグレーションが支配的コスト（87%）」という起票時の前提が誤りと判明（実際は約7%・1.36秒）したため、実装せず取り下げ。真因と実測データはnotes参照。
<!-- SECTION:FINAL_SUMMARY:END -->
