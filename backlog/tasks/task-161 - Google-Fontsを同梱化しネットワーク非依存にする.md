---
id: TASK-161
title: Google Fontsを同梱化しネットワーク非依存にする
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 17:54'
updated_date: '2026-07-30 21:43'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Google Fonts woff2を同梱しself-host化
2. index.htmlの外部参照削除
3. TASK-108（ビジュアルテストのフォント依存）との整合確認
実装Cursor委譲
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-108（先行起票）と同一内容の重複起票だったためクローズ。実装はTASK-108で実施。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TASK-108と重複のためそちらへ統合。
<!-- SECTION:FINAL_SUMMARY:END -->
