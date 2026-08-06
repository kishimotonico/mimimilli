---
id: TASK-219
title: clientテストの実タイマー待ちをfake timers化し重複テストを削る
status: Done
assignee:
  - '@impl-219'
created_date: '2026-08-06 17:26'
updated_date: '2026-08-06 17:42'
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
- [x] #1 WorkGrid の10,000件版仮想化テストが削除されている
- [x] #2 実タイマー待ちが原因で1秒を超えていたテストがfake timers化などで短縮されている（対象と前後の実測をnotesに記録）
- [x] #3 client全体のvitest実行時間が実測で短縮されている（目安: 25秒→20秒以下。到達できない場合は実測値と理由をnotesに記録）
- [x] #4 pnpm --filter @mimimilli/client test が全件通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装報告（impl-219）: 変更3ファイル（WorkGrid/WorkListPane/scanModal のテスト）。WorkGridの10,000件版仮想化テストを削除、afterEachの実時間200ms待ち（react-virtual debounce消化用）を撤去、scanModal遷移テストをfake timers化（advance 2段、Presence退出タイマーの都合）。単体実測: WorkGrid 6.49s→2.48s、scanModal 4.75s→2.31s、WorkListPane 2.97s→1.85s。全体wallは25.1s→約24s（3回: 24.21/24.99/23.53）で目安20sに未達。理由: wallの支配項はper-fileのjsdom environment初期化（集計106〜115s）とimport（48〜50s）で、今回のスコープ外。テスト702件全pass・typecheck通過・プロダクトコード無変更。

レビュー（review-219）: 指摘なし。理論的リスクとしてreact-virtualのdebounceタイマー（150ms）がunmount後もキャンセルされない点が挙がったが、実測3回で影響なしと確認。fake timersはtry/finallyでuseRealTimers復元済み。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
clientテストの実タイマー待ちを解消: WorkGrid/WorkListPaneのafterEach実時間200ms待ち撤去、scanModal遷移テストのfake timers化、WorkGrid 10,000件版重複テスト削除。単体実測 WorkGrid 6.49s→2.48s / scanModal 4.75s→2.31s / WorkListPane 2.97s→1.85s。全体wallは約24sで目安20s未達（支配項はjsdom初期化とimportコストでスコープ外、notesに記録）。702テスト全pass・typecheck通過。Sonnetレビュー済み、コミット7f5ae7b。
<!-- SECTION:FINAL_SUMMARY:END -->
