---
id: TASK-246
title: cn()をclsx+tailwind-mergeへ置換しTailwindクラス競合を解決する
status: Done
assignee: []
created_date: '2026-08-07 17:14'
updated_date: '2026-08-07 17:50'
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
- [x] #1 cnがclsx+tailwind-merge実装になり既存の呼び出しが全て動作する
- [x] #2 IconButtonの既知バグ(rounded-*上書き不安定)が解消されコメントが削除されている
- [x] #3 pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
cn()をclsx+tailwind-merge実装へ置換。extendTailwindMergeでradiusのclassGroupに独自トークン(rounded-1〜4/pill)のみを追加し、IconButtonのrounded-*上書きがCSS生成順に依存して不安定だった既知バグを解消した。素のtwMergeはcolor/font/shadow系の独自トークンを標準マッチャーで解決できるがradius系のみ未認識であることを実測で切り分け、extend対象を最小限に絞っている。Tag.tsxのopacity競合も同型の潜在バグだったがtwMergeの標準機能で併せて解消。pnpm check・pnpm test(736 passed)・pnpm test:smoke(10/10)で検証。
<!-- SECTION:FINAL_SUMMARY:END -->
