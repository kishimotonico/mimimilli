---
id: TASK-33.1
title: '契約・コア: タグ正規化・動的分類軸・完全一致絞り込み'
status: Done
assignee: []
created_date: '2026-07-10 19:38'
updated_date: '2026-07-10 19:52'
labels: []
dependencies: []
parent_task_id: TASK-33
priority: high
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
shared契約とserver coreをADR-0005の決定に合わせて変更する。

## 内容
- shared: tagPrefixスキーマ新設（prefix/label/color/showAsAxis/protected）。予約ID（all/recent/added/fav/unplayed/missing/tag/year、smart-*接頭）とスラッシュ入りprefixの拒否をZodで表現
- shared: normalizeTag（prefix小文字化・値trim）を追加し、facetAxisSchema と AXIS_TAG_PREFIX を廃止。WorksQuery.axis は文字列へ
- core worksQuery: filterByTags を完全一致（prefixは大小無視・値は区別）へ。filterByAxis は year=addedAt年照合、その他=parseTagでprefix/value完全一致
- core axisFacets: 任意のprefix軸を集計可能に。tag軸=フラットのみ、year軸=addedAt由来は維持
- 既存テストの更新と、year軸ドリル・正規化・完全一致の回帰テスト追加
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 normalizeTagがprefixを小文字化し値をtrimする（テストあり）
- [x] #2 year軸のドリルがaddedAtの年で正しく絞り込まれる（現行の0件バグの回帰テストあり）
- [x] #3 タグAND/OR絞り込みが完全一致になり、部分一致でヒットしない
- [x] #4 任意の登録prefix（例: 気分/）でファセット集計とドリルが動く
- [x] #5 server配下の既存テストがすべて通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
shared に normalizeTag/normalizeTags/tagEquals と tagPrefix 契約を追加し、facetAxisSchema/AXIS_TAG_PREFIX を廃止して axis を prefix 文字列化。core は完全一致絞り込み・動的 prefix 軸集計・year軸の addedAt 照合へ変更。回帰テスト追加、server 119件グリーン
<!-- SECTION:FINAL_SUMMARY:END -->
