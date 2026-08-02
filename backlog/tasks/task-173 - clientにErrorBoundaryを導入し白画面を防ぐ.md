---
id: TASK-173
title: clientにErrorBoundaryを導入し白画面を防ぐ
status: To Do
assignee: []
created_date: '2026-08-02 06:59'
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
- [ ] #1 レンダリング例外発生時に白画面ではなくエラー表示と再読み込み導線が出る
- [ ] #2 エラー内容（メッセージ・スタック）が画面またはconsoleから確認できる
- [ ] #3 pnpm checkとpnpm testが通る
<!-- AC:END -->
