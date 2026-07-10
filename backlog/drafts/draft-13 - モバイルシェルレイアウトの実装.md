---
id: DRAFT-13
title: モバイルシェルレイアウトの実装
status: Draft
assignee: []
created_date: '2026-07-10 12:34'
labels: []
dependencies:
  - TASK-30
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
狭幅時にAppShellのデスクトップ3ペイン構成をモバイル向けレイアウトに切り替える。ブレークポイント・分岐方式・ナビ形態はTASK-30のADRに従う。スコープはシェルとナビゲーションのみで、各画面の中身は別ドラフト。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スマホ幅で1カラム＋モバイルナビ（形態はADR準拠）に切り替わる
- [ ] #2 ブレークポイントがトークンとして定義され、共有フック/ユーティリティ経由で参照される
- [ ] #3 デスクトップ表示に回帰がない（ビジュアルテスト通過）
<!-- AC:END -->
