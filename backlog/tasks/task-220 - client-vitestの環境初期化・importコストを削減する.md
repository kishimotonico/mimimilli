---
id: TASK-220
title: client vitestの環境初期化・importコストを削減する
status: Done
assignee:
  - '@impl-220'
created_date: '2026-08-06 23:09'
updated_date: '2026-08-06 23:18'
labels: []
dependencies: []
priority: medium
ordinal: 230000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
実測（2026-08-07, TASK-219）でclient vitest（96ファイル/703テスト）のwall 24〜25秒の支配項は、テスト本体ではなくper-fileのjsdom environment初期化（集計106〜115秒）とimport（集計48〜50秒）と判明した。テスト内容ではなく実行基盤の構造コストのため、環境・設定側で削減する。候補: happy-domへの環境切替、vitestのpool/isolate設定の見直し、環境の共有化など。プロトタイプで実測比較し、テストが全件通り設定がクリーンに保てる案があれば採用する。参考実測: TASK-219 notes、計測ログ /tmp/claude-1000/-home-nico-projects-mimikago/654bc177-9bf3-4a82-914f-4d46f3b835d6/scratchpad/client-vitest.json
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 候補案（最低: happy-dom切替、pool/isolate調整）ごとの実測wall時間の比較と互換性の可否がnotesに記録されている
- [x] #2 有効な案があれば適用され、clientテストが全件通る。有効な案がなければ現状維持の判断と理由が記録されている
- [x] #3 適用した場合、client全体のvitest実行時間が実測で短縮されている（前後の実測をnotesに記録）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装報告（impl-220）: environmentをjsdom→happy-domへ切替＋pool:threads追加で、wall 23.8s→13.6s（約43%短縮、5回計測で安定）。environment集計103s→47s、tests集計51s→18s。isolate:falseは7秒台まで縮むがDOM状態漏れで非決定的に29〜57件失敗するため却下（テスト分離を壊すハックは不採用）。互換性差異なし（dialogやResizeObserver等のギャップは既存setup.tsスタブがカバー）。変更: client/vite.config.ts、client/package.json（jsdom削除・happy-dom追加）、pnpm-lock.yaml、テスト9ファイルのコメント文言のみ。702件pass・typecheck/lint/fmt通過。

レビュー（review-220）: 指摘なし。pnpm-lock.yamlの変更はhappy-dom差し替えから自然に導かれる範囲のみ、esbuildのoptionalDependencies（26種）は欠落なし（既知のlock破損パターン再発なし）。vite.config.tsの変更はtestブロックに閉じており、dev/build挙動への影響なし。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
client vitestの環境をjsdom→happy-domへ切替えpool:threadsを追加。wall 23.8s→13.6s（約43%短縮）、702テスト全pass・typecheck/lint/fmt通過。isolate:falseはテスト分離が壊れ非決定的失敗が出るため実測の上で却下。Sonnetレビュー済み（lockのesbuild破損なし確認込み）、コミット8a2ef84、masterへマージ済み。
<!-- SECTION:FINAL_SUMMARY:END -->
