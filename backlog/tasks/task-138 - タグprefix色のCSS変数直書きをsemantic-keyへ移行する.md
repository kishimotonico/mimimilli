---
id: TASK-138
title: タグprefix色のCSS変数直書きをsemantic keyへ移行する
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 12:31'
updated_date: '2026-07-30 16:35'
labels: []
dependencies: []
priority: medium
ordinal: 148000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
shared/src/tagPrefix.ts:74-104 の DEFAULT_TAG_PREFIXES が color に "var(--cv-color)" 等のCSS変数文字列を直書きし、この値が user DB に永続化され、client/src/entities/work/ui/Tag.tsx:106 でそのままインラインstyleへ埋め込まれる。契約層・server seedがclientのpresentation実装名（CSS変数名）へ固定される設計で、変数名のリネームが永続データの破壊になる。tagPrefixCreateSchema（shared/src/tagPrefix.ts:46-52）のcolorは自由文字列で、ユーザー作成prefixも任意値が入る。

方向: wire/persistence値をsemantic color key（例: "cv" | "circle" | "series" | ... のenumか任意key）にし、CSS変数への変換はclient側のマッピングに置く。既存user DBの値は破壊してよい（DBはキャッシュ扱い・未公開）が、.meta.jsonにはprefix色は保存されないことを確認の上、user.sqlite再作成で済むならその旨をタスク内で明記して対応する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 sharedの既定prefixとスキーマがCSS変数文字列を持たず、semantic keyで表現されている
- [x] #2 clientがkey→CSS変数の変換を一元的に行い、タグ表示の見た目が現状と同等
- [x] #3 pnpm check・pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. prefix色をsemantic keyへ（sharedの既定値・スキーマ変更）
2. client側にkey→CSS変数マッピングを一元化
3. user DB再作成で移行（バージョンbump）
4. pnpm check + pnpm test
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor(composer-2.5)で実装。キー集合はcv/circle/series/cat（tokens.cssの既存変数に対応）。key→CSS変数の解決はclientのtagPrefixColor.tsに一元化、USER_SCHEMA_VERSION 6へbumpで旧値を掃除。workRepoの読み出しにもスキーマparseを追加。全体check+test:server 355件+test:client 396件通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
タグprefix色をsemantic key（enum）へ移行し、CSS変数への解決をclient1箇所に集約。契約層からpresentation実装名を排除した。
<!-- SECTION:FINAL_SUMMARY:END -->
