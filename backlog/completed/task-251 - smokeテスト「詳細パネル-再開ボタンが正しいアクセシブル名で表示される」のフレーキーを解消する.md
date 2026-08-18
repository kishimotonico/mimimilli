---
id: TASK-251
title: 'smokeテスト「詳細パネル: 再開ボタンが正しいアクセシブル名で表示される」のフレーキーを解消する'
status: Done
assignee: []
created_date: '2026-08-08 08:49'
updated_date: '2026-08-11 10:52'
labels: []
dependencies: []
ordinal: 261000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-248の検証中に pnpm test:smoke のフルスイートで1件失敗した。単体で再実行すると成功する（3.9s）ため、フィクスチャ状態の共有に起因するフレーキーと判断した。

失敗内容: getByText("夜更けの図書室で囁き朗読").click() が30秒でタイムアウト。テスト自体は resume API の状態とタイトルテキストの検索で、ポップオーバーや位置決めとは無関係。TASK-248由来のregressionではない。

フルスイートでは依然として赤くなり得るため、原因（前のテストが残す状態か、フィクスチャサーバーの応答か）を特定して解消する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 フルスイートの pnpm test:smoke を連続3回実行して当該テストが安定して通る
- [x] #2 フレーキーの原因（共有状態かタイミングか）が特定されタスクのnotesに記録されている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
原因は共有状態とタイミングの複合。resume APIのサーバー状態は無関係だった。(1) 共有状態: workers=1 で同一 browser context を使うため、グリッド表示が localStorage の libraryViewModeAtom（mimimilli:libraryViewMode）として後続テストへ残り、作品行が仮想化で見えずクリック待ちが30秒タイムアウトしていた。フィルタはURL同期なので goto('/') でリセットされるが localStorage はされていなかった。(2) 起動待ち: webServer がポートのTCP開放だけを見ており fixture API middleware の初期化完了を保証していなかった。openApp も networkidle のみで作品一覧の描画完了を待っていなかった。対応は openApp での localStorage/sessionStorage クリア、webServer を url: /api/settings 待ちへ、openApp を結果面と作品行の描画待ちへ変更。ブート待ちのみ 20秒を明示（グローバルの expect timeout は既定5秒のまま）。既定5秒のままだと『主要画面でヨコ方向スクロールが発生しない』が3回中1回落ちたが、20秒化で解消した。検証: pnpm test:smoke フルスイート3連続すべて10件パス（対象テストは1.6〜1.9秒）。1回目のみ2.6分、2・3回目は21〜23秒で、冷起動時のVite依存最適化ぶんの差。pnpm check・pnpm test 通過。ブランチ feat/task-251-flaky-smoke-resume（3c0d0ce）。
<!-- SECTION:NOTES:END -->
