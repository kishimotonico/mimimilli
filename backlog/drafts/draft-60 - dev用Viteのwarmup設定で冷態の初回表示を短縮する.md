---
id: DRAFT-60
title: dev用Viteのwarmup設定で冷態の初回表示を短縮する
status: Draft
assignee: []
created_date: '2026-08-17 20:22'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-323の調査中にCursorが提案した vite.config の server.warmup（index.html / src/main.tsx を事前変換）を、開発体験の改善として検討する。

TASK-323は再現しない事象だったため当該変更は破棄した。warmup自体は単体では筋の良い設定だが、この環境で実際に効果があるかは未計測。

要件が未定なのは次の点:
- 冷えた node_modules/.vite の状態で、warmupあり/なしの初回表示までの所要時間に有意な差が出るか（未計測）
- 差が出ない場合は設定を足す理由がない
- smoke実行時間への影響も未計測

着手するなら、まず warmup あり/なしで冷態の初回表示までを複数回実測し、有意な改善が確認できた場合にのみタスク化する。
<!-- SECTION:DESCRIPTION:END -->
