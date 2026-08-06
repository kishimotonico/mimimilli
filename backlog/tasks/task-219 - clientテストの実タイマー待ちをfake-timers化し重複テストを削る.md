---
id: TASK-219
title: clientテストの実タイマー待ちをfake timers化し重複テストを削る
status: To Do
assignee: []
created_date: '2026-08-06 17:26'
labels: []
dependencies: []
priority: medium
ordinal: 229000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
実測（2026-08-07）でclient vitestは25.1秒。突出して遅いテストに実タイマー待ち（setTimeoutの実測待ち）とみられるものがある: scanModal.test.ts の実行中→完了遷移テスト（2.6秒）、WorkGrid.test.tsx の仮想化テスト（1.4秒/0.67秒）など上位ファイル（WorkGrid 6.5s / scanModal 4.7s / WorkListPane 3.0s 等）。vi.useFakeTimers() 化で短縮する。またWorkGridの仮想化テストは同一分岐を10,000件と1,000件で二重検証しており、10,000件版は削除する。方針: テストの網羅性より開発速度を優先し、足枷になる過剰テストは削除してよい。ただしコードのクリーンさは最優先。計測ログ: /tmp/claude-1000/-home-nico-projects-mimikago/654bc177-9bf3-4a82-914f-4d46f3b835d6/scratchpad/ の client-vitest.json 等。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WorkGrid の10,000件版仮想化テストが削除されている
- [ ] #2 実タイマー待ちが原因で1秒を超えていたテストがfake timers化などで短縮されている（対象と前後の実測をnotesに記録）
- [ ] #3 client全体のvitest実行時間が実測で短縮されている（目安: 25秒→20秒以下。到達できない場合は実測値と理由をnotesに記録）
- [ ] #4 pnpm --filter @mimimilli/client test が全件通る
<!-- AC:END -->
