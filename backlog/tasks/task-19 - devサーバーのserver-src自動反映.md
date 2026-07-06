---
id: TASK-19
title: devサーバーのserver/src自動反映
status: Done
assignee:
  - '@claude'
created_date: '2026-07-05 17:59'
updated_date: '2026-07-06 03:10'
labels:
  - dx
dependencies: []
references:
  - docs/BACKLOG.md
priority: medium
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server/src配下の変更がvite devサーバーに自動反映されず、手動再起動が必要な状態が続いている。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 vite.config等でserver workspaceをwatchし、変更検知時に自動でserverプロセスを再起動する仕組みを導入する
- [x] #2 server/srcのファイルを変更した際、手動操作なしで変更が反映されることを確認する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. client/vite.config等でserverワークスペース（Honoアプリ）がdevサーバーにどう組み込まれているか調査
2. server/src変更時に自動で反映される仕組みを実装（vite watcherでのモジュール無効化 or プロセス再起動、構成に応じて適切な方を選ぶ）
3. 検証はClaudeがdevサーバー実機で実施（server/srcを変更→手動操作なしでAPIレスポンスに反映されることを確認）
4. 実装はCodexへ委譲、コミットはClaude
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装はCodexへ委譲、レビュー・実機検証・コミットはClaude。

- 原因: fixture APIがvite.configの静的importで読み込まれ、plugin初期化時に一度だけアプリ生成されていたため、server/srcの変更がViteのモジュールグラフに乗らなかった
- 解決: ssrLoadModule経由の遅延読み込み + watcher監視 + 変更時のモジュール無効化 + 次リクエストで再生成。dev:real（BACKEND_URL proxy）には影響なし
- 実機検証: devサーバー再起動なしで、fixture/data.tsのタイトル変更が/api/worksレスポンスに即反映されること、git checkoutでの巻き戻しも即反映されることを確認。深い階層のモジュール変更でも親まで無効化が波及することを実証済み
- pnpm check通過、アプリ起動確認済み
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
vite devでserver/src・shared/srcの変更が手動再起動なしで反映されるようにした（ssrLoadModule+watcher+モジュール無効化）。実機でdata.ts変更の即時反映を確認（コミットは直前のfeatコミット）
<!-- SECTION:FINAL_SUMMARY:END -->
