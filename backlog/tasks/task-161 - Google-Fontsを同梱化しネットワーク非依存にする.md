---
id: TASK-161
title: Google Fontsを同梱化しネットワーク非依存にする
status: To Do
assignee: []
created_date: '2026-07-30 17:54'
labels: []
dependencies: []
priority: medium
ordinal: 171000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/index.html:8がGoogle Fontsを外部取得しており、localhost常駐・Bun compile配布（DRAFT-1）前提ではDNS・TLS・外部回線・オフライン状態が初回表示を左右する。フォントをリポジトリへ同梱（woff2をself-host）し、外部リクエストをゼロにする。ビジュアルテストのフォント依存解消（TASK-108）とも関連するため、着手時に整合を確認する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 本番ビルド・開発時ともに外部フォント取得リクエストが発生しない（フォントは同梱woff2から配信）
- [ ] #2 表示フォント・ウェイトが変更前と同一（ビジュアルテストが通る）
- [ ] #3 オフライン状態でも初回表示がフォント起因で遅延・変化しない
- [ ] #4 pnpm check と pnpm test が通る
<!-- AC:END -->
