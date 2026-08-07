---
id: TASK-247
title: TagComboboxのローカル正規化をsharedのnormalizeTagへ統一する
status: To Do
assignee: []
created_date: '2026-08-07 17:14'
labels: []
dependencies: []
ordinal: 257000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/src/shared/ui/TagCombobox.tsx:16-18 のローカルnormalizeTag(trim+toLocaleLowerCaseのみ)が、shared/src/tagNormalize.ts のnormalizeTag(prefix/valueルール付き・ADR-0005のタグ同一性の正)と乖離している。検索マッチ・タグ作成判定にsharedの正規化を使うよう統一する（ライブラリ導入ではなくドメインルール乖離の修正）。動作差分（大文字小文字・prefix付き入力の扱い）はテストで固定する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 TagCombobox内のローカルnormalizeTagが削除されsharedのnormalizeTagが使われている
- [ ] #2 既存の候補マッチ・新規作成judgの挙動差分がテストで検証されている
- [ ] #3 pnpm check と変更範囲のテストが通る
<!-- AC:END -->
