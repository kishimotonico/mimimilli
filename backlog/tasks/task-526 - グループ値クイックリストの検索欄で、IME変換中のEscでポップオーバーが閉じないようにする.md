---
id: TASK-526
title: グループ値クイックリストの検索欄で、IME変換中のEscでポップオーバーが閉じないようにする
status: To Do
assignee: []
created_date: '2026-11-26 03:14'
labels:
  - client
  - bug
dependencies: []
priority: medium
ordinal: 645000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GroupValueQuickList の検索欄で IME 変換中に Esc を押すと、変換のキャンセルではなくポップオーバーが閉じる。原因は client/src/features/library/ui/GroupValueQuickList.tsx の handleListKeyDown（160行目付近）と handleSearchKeyDown（175行目付近）が、Escape を isComposing を見ずに close() へ流していること。Playwright の CDP（Input.imeSetComposition）で変換状態にして Esc を送ると閉じることを確認済み。再現: 検索欄に日本語を入力し、変換中のまま Esc を押す。
UIプリミティブの置き換え（ADR-0043）でダイアログ・ポップオーバーを Ark UI へ寄せると、その置き換えで解消する可能性がある。関連: TASK-525、doc-10。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 変換中（isComposing）のEscでポップオーバーも候補も閉じない
- [ ] #2 変換していない状態のEscは従来どおりポップオーバーを閉じる
- [ ] #3 isComposing の keydown を送る単体テストがある
<!-- AC:END -->
