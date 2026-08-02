---
id: TASK-173
title: clientにErrorBoundaryを導入し白画面を防ぐ
status: Done
assignee: []
created_date: '2026-08-02 06:59'
updated_date: '2026-08-02 07:37'
labels: []
dependencies: []
priority: medium
ordinal: 183000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計方針のクライアント側対応。client/srcにはErrorBoundaryが存在せず(main.tsx:11で直接マウント)、レンダリング例外は白画面になり手がかりが残らない。ルートにErrorBoundaryを導入し、エラー概要と再読み込み導線を表示する。デザインはdocs/design-system.mdに従う。サーバーへのエラー報告基盤は作らない（設計方針の「やらないこと」）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 レンダリング例外発生時に白画面ではなくエラー表示と再読み込み導線が出る
- [x] #2 エラー内容（メッセージ・スタック）が画面またはconsoleから確認できる
- [x] #3 pnpm checkとpnpm testが通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor委譲で実装、統括レビュー済み。RootErrorBoundary(class component、依存追加なし)でmain.tsxのマウントをラップ。design-systemトークン・既存Button流用。componentDidCatchでconsole.error記録。ユニットテスト2件追加、agent-browser実機で通常表示と発火時のエラー画面(再読み込み導線・詳細折りたたみ)を確認済み。pnpm check合格、server 439/client 603テスト全パス
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ルートErrorBoundaryを導入し、レンダリング例外時に白画面ではなくエラー表示＋再読み込み導線を出すようにした
<!-- SECTION:FINAL_SUMMARY:END -->
