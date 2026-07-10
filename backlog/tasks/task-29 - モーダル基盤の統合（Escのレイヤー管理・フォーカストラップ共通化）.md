---
id: TASK-29
title: モーダル基盤の統合（Escのレイヤー管理・フォーカストラップ共通化）
status: To Do
assignee: []
created_date: '2026-07-10 10:39'
labels:
  - ui
dependencies: []
priority: medium
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設定モーダル・スキャン結果ポップアップ・スマートフォルダーエディタがそれぞれ独自のEsc/outside-click/フォーカス管理を持つ。NewWorkPopupのEsc伝播バグ（局所修正済み予定）の根本対策として、最前面だけが閉じるレイヤー管理を持つ共通モーダル基盤（またはネイティブdialogへの統一。前例: FullScreenPlayer）に統合する。単純な共通useEscapeでは不十分。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 3つのモーダル系UIが共通基盤（またはnative dialog）上で動く
- [ ] #2 モーダル多重時にEscは最前面だけを閉じる
- [ ] #3 フォーカストラップとbackdropクリックの挙動が統一される
<!-- AC:END -->
