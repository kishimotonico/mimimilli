---
id: TASK-60
title: リスト表示のカバー画像をサムネイル+遅延読込にする
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-19 02:02'
updated_date: '2026-07-19 12:31'
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
- [x] #1 WorkRow のカバーが requestWidth 指定のサムネイルURL+loading=lazy で取得される
- [x] #2 固定サイズでカバーを表示する他の箇所（詳細プレビュー・プレイヤー等）にも適切な requestWidth が指定されている
- [x] #3 pnpm check が通る
- [x] #4 リスト表示で幅指定なしの元画像URLを一切要求しない（?w=は許可幅128/256/512のいずれか）
- [x] #5 カバーなし・読込エラー時のプレースホルダー表示が退行しない。プレイヤー・詳細など画面内1件のカバーはeagerのままrequestWidthのみ付与
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. entities/work/ui/ に固定サイズ用の幅選択ヘルパー selectFixedCoverThumbnailWidth(displaySize, dpr) を新設（表示サイズxDPR以上の最小許可幅128/256/512を返すceil方式。アップスケール回避） 2. WorkRow.tsx に requestWidth + loading=lazy を付与 3. 固定サイズの他箇所に requestWidth のみ付与（eager維持）: AxisLanding(80) / WorkDetail(140) / BarContent(46) / FullScreenPlayer(320) / PopupContent(fit=fill可変のため512固定) 4. tests/unit/coverThumbnailWidth.test.ts を追加（ヘルパー単体＋WorkRowレンダリングで ?w= と lazy を検証） 5. pnpm check と pnpm test:client で検証
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
WorkRowのカバーをrequestWidth指定+loading=lazy化。entities/work/ui/coverThumbnailWidth.tsに固定サイズ用幅選択ヘルパー(ceil方式)を新設し、AxisLanding/WorkDetail/BarContent/PopupContent/FullScreenPlayerにもrequestWidthを付与(eager維持)。ユニットテスト15件追加。pnpm check・pnpm test(server 183/client 261)すべてパス
<!-- SECTION:FINAL_SUMMARY:END -->
