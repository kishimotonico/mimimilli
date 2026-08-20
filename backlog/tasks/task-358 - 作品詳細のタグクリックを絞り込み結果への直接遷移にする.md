---
id: TASK-358
title: 作品詳細のタグクリックを絞り込み結果への直接遷移にする
status: Done
assignee:
  - '@claude'
created_date: '2026-08-20 15:28'
updated_date: '2026-08-20 16:28'
labels: []
dependencies: []
ordinal: 358000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
作品詳細のタグラベルをクリックすると常にタグ軸（全タグ一覧）へ遷移し、絞り込み済みの作品一覧に到達するには同じタグをもう一度クリックする必要がある（ADR-0013の現仕様、selectSoleLibraryTagAtom）。ユーザー期待は「タグクリック＝そのタグの作品一覧」であり、2クリック動線をやめて作品一覧からのタグ選択（replaceLibraryTagAtom）と同じ1クリック動線に統一する。

方針（2026-08-21ユーザー決定）:
- 作品詳細のタグクリックは replaceTag と同一挙動にする: 選択タグをそのタグ1件に置換し、works種の結果面を維持（value-list種にいた場合は「すべての作品」軸へ）、作品詳細は閉じる
- タグの分類軸は「全タグ一覧のブラウズ用カタログ」に徹する（役割拡張はしない）
- あわせて堅牢化: タグ軸の値一覧描画で normalizeTag が null を返す値があると buildFilterTag が render 中に throw して RootErrorBoundary に落ちる潜在経路（client/src/features/library/model/libraryPresentation.ts の buildFilterTag、client/src/features/library/ui/AxisValueList.tsx）があるため、不正値はスキップ＋console.warn にする

関連: ADR-0013（入口別既定動作の表に「作品詳細のタグクリック→タグ軸へ遷移」と明記されているため改定が必要）、ADR-0012（軸＝値ブラウズの思想は維持）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 作品詳細のタグラベルをクリックすると、1クリックでそのタグ1件に絞り込まれた作品一覧が表示される（replaceLibraryTagAtomと同一挙動、作品詳細は閉じる）
- [x] #2 selectSoleLibraryTagAtomと常にタグ軸へ遷移する規則が廃止され、未使用コードが残っていない
- [x] #3 分類軸のタグ（タグ軸）の挙動は変更されず、全タグ一覧のカタログとして従来どおり機能する
- [x] #4 ADR-0013の入口別既定動作の表と軸遷移規則の記述が新挙動に合わせて改定されている
- [x] #5 タグ軸の値一覧に正規化不能なタグ値が含まれてもアプリ全体がクラッシュせず、当該値はスキップされconsole.warnされる
- [x] #6 作品詳細のタグクリックでもCtrl+クリックで既定動作が反転しAND追加になる（ADR-0013「反転は全入口で維持」に整合。現状は修飾キーがハンドラへ渡っていない）
- [x] #7 client/tests/unit/libraryNavigationActions.test.ts を新挙動（selectSole廃止・replaceTag統一）に更新し、作品詳細タグクリックの新動線を検証するsmokeケースを追加して pnpm test:smoke が通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
作品詳細のタグクリックをselectSoleLibraryTagAtom（常にタグ軸へ遷移する2クリック動線）からreplaceLibraryTagAtomの1クリック絞り込みへ統一し、Ctrl/Cmd+クリックでAND追加に反転する伝搬をTag.tsx〜LibraryView.tsxに実装。正規化不能なfacet値はuseAxisFacetsQueryのfilterValidFacetItemsでスキップ＋console.warnしrender中throwのクラッシュ経路を除去。ADR-0013改定。pnpm check / pnpm test(824 pass) / pnpm test:smoke(17 pass)通過、fixture実機で3動線確認。Sonnetレビューで副作用なしを確認しmasterへマージ済み。
<!-- SECTION:FINAL_SUMMARY:END -->
