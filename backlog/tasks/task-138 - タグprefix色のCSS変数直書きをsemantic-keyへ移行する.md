---
id: TASK-138
title: タグprefix色のCSS変数直書きをsemantic keyへ移行する
status: To Do
assignee: []
created_date: '2026-07-30 12:31'
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
- [ ] #1 sharedの既定prefixとスキーマがCSS変数文字列を持たず、semantic keyで表現されている
- [ ] #2 clientがkey→CSS変数の変換を一元的に行い、タグ表示の見た目が現状と同等
- [ ] #3 pnpm check・pnpm test が通る
<!-- AC:END -->
