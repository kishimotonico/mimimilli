---
id: TASK-247
title: TagComboboxのローカル正規化をsharedのnormalizeTagへ統一する
status: Done
assignee: []
created_date: '2026-08-07 17:14'
updated_date: '2026-08-07 17:52'
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
- [x] #1 TagCombobox内のローカルnormalizeTagが削除されsharedのnormalizeTagが使われている
- [x] #2 既存の候補マッチ・新規作成judgの挙動差分がテストで検証されている
- [x] #3 pnpm check と変更範囲のテストが通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TagComboboxのローカルnormalizeTag(trim+toLocaleLowerCase)を削除し、shared/src/tagNormalize.tsのnormalizeTag(ADR-0005決定5準拠、NormalizedTag|nullを返す)へ統一。クエリ・excludeTags・候補ループの3箇所でnullを明示的に弾く。挙動差分はflatタグの大文字小文字区別・prefix部分のみ小文字化・exclude判定も同様・正規化不能入力の除外の4点で、テスト10ケースで固定。候補検索が大文字小文字を区別するようになった点はTASK-249へ分離。
<!-- SECTION:FINAL_SUMMARY:END -->
