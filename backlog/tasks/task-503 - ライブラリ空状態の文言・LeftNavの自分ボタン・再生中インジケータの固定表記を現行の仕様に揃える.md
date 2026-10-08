---
id: TASK-503
title: ライブラリ空状態の文言・LeftNavの自分ボタン・再生中インジケータの固定表記を現行の仕様に揃える
status: Done
assignee:
  - '@mimi2'
created_date: '2026-10-08 03:55'
updated_date: '2026-10-08 04:12'
labels:
  - client
  - ui
dependencies: []
priority: low
ordinal: 561000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-10-08 点検バッチ（TASK-497レビュー）で見つかった表示のずれ。(1) client/src/features/library/model/emptyWorks.ts の空状態文言「☆ボタンでお気に入りに追加」が、作品アクションの名称「ブックマーク」（WorkMetadataActions.tsx）と食い違う。(2) LeftNav の「自分」ボタンだけ onClick も disabled も無く、他の未実装ボタン（履歴・お気に入り・ピン留め）の disabled＋「近日実装」と揃っていない。(3) TopBar の再生中インジケータが固定文字列 "1ch" を出しているが、実際のチャンネル数ではなく、マルチch同時再生は提供しない（requirements-v4 7.7）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 空状態の文言が作品アクションの名称（ブックマーク）とビュー名（お気に入り）の対応どおりになっている
- [x] #2 LeftNavの「自分」ボタンが他の未実装ボタンと同じくdisabledで近日実装と分かる
- [x] #3 再生中インジケータに固定の1ch表記が無い
- [x] #4 pnpm check && pnpm test && pnpm test:smoke が通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
空状態の文言をアイコンに依存しない「作品をブックマークするとお気に入りに表示されます」に、LeftNav の自分ボタンを disabled＋近日実装に、TopBar の固定 1ch 表記を削除。 個別レビュー＋統合ブランチの横断レビュー、feat/audit-sweep 先端で pnpm check・test 全通過、smoke 29/30（失敗1件は別プロジェクトの vite とのポート衝突で、単体再実行3/3通過）。17736da3 で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
