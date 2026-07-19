---
id: TASK-60
title: リスト表示のカバー画像をサムネイル+遅延読込にする
status: To Do
assignee: []
created_date: '2026-07-19 02:02'
updated_date: '2026-07-19 04:28'
labels: []
dependencies: []
priority: high
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リスト表示の WorkRow（client/src/features/library/ui/WorkRow.tsx:41）は CoverImg に requestWidth も loading も渡しておらず、全行が元画像をeagerで取得する。グリッド側（WorkGrid.tsx:308）は requestWidth+loading=lazy 済みなのでリスト側だけの抜け。元画像平均500KBなら30,000件で理論上15GB相当の要求になり得る。あわせて詳細・プレイヤー等の固定サイズカバーにも適切な requestWidth が渡っているか点検する。

小粒で即効性が高い独立修正。2026-07-19のパフォーマンス調査で高優先度と判定。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WorkRow のカバーが requestWidth 指定のサムネイルURL+loading=lazy で取得される
- [ ] #2 固定サイズでカバーを表示する他の箇所（詳細プレビュー・プレイヤー等）にも適切な requestWidth が指定されている
- [ ] #3 pnpm check が通る
- [ ] #4 リスト表示で幅指定なしの元画像URLを一切要求しない（?w=は許可幅128/256/512のいずれか）
- [ ] #5 カバーなし・読込エラー時のプレースホルダー表示が退行しない。プレイヤー・詳細など画面内1件のカバーはeagerのままrequestWidthのみ付与
<!-- AC:END -->
