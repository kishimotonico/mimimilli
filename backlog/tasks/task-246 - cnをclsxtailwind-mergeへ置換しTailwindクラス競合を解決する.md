---
id: TASK-246
title: cn()をclsx+tailwind-mergeへ置換しTailwindクラス競合を解決する
status: To Do
assignee: []
created_date: '2026-08-07 17:14'
labels: []
dependencies: []
ordinal: 256000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ライブラリ積極導入方針（docs/adr/0014の背景と同じ方針転換）に基づく置換。client/src/shared/lib/cn.ts(3行)は filter(Boolean).join のみでTailwindクラス競合を解決できず、IconButton.tsx:12-14に既知の不具合コメントがある（rounded-*上書きがCSS生成順依存で不安定）。clsx+tailwind-mergeによるshadcn型のcn実装へ置き換える。cnは20+ファイルで使用中だがシグネチャ互換なので呼び出し側の変更は原則不要。motion移行(TASK-238〜)の前に完了させることが望ましい（移行中のclassName記述をtwMerge前提にできるため）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 cnがclsx+tailwind-merge実装になり既存の呼び出しが全て動作する
- [ ] #2 IconButtonの既知バグ(rounded-*上書き不安定)が解消されコメントが削除されている
- [ ] #3 pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->
