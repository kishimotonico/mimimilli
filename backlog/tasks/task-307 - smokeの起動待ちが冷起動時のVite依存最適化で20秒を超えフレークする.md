---
id: TASK-307
title: smokeの起動待ちが冷起動時のVite依存最適化で20秒を超えフレークする
status: To Do
assignee: []
created_date: '2026-08-11 11:20'
labels: []
dependencies: []
priority: low
ordinal: 317000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-251の修正(openAppの明示的な描画待ち、bootTimeout 20秒)後も、Vite依存キャッシュが無い冷起動の初回テストのみ起動待ちが20秒を超えて失敗することがある。2026-08-11のビュー軸再編マージ後の初回smoke実行で「ライブラリシェル: 軸レール・結果面・チップ列が表示される」が1回失敗(support.ts:30の可視待ちタイムアウト、全体2.9分)、直後の再実行では10/10パス(21秒)。温まっていれば安定。対策候補: webServerのreadiness確認をfixture APIだけでなくクライアントバンドルの初回変換完了まで広げる、smoke実行前にViteキャッシュをウォームする、初回テストのみbootTimeoutを延ばす、のいずれか。頻度は低い(キャッシュ破棄後の初回のみ)。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Vite依存キャッシュを削除した状態からのpnpm test:smokeが安定して通る
- [ ] #2 温まった状態のsmoke実行時間が悪化しない
<!-- AC:END -->
