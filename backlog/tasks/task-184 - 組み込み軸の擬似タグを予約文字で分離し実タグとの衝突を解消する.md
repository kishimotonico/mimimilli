---
id: TASK-184
title: 組み込み軸の擬似タグを予約文字で分離し実タグとの衝突を解消する
status: In Progress
assignee:
  - impl-184
created_date: '2026-08-04 11:36'
updated_date: '2026-08-04 11:48'
labels: []
dependencies: []
priority: high
ordinal: 194000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codex レビュー（2026-08-04、コミット e14e917〜aa66106 対象）で見つかった TASK-180 の欠陥3件をまとめて修正する。ADR-0012 §2 を改訂済みなので、そちらが正。

1. 実タグ year/* と擬似タグの衝突（P1）
現状 libraryPresentation.ts の splitSelectedTags は先頭が year/ のタグを全て addedAt の年照合として解釈する。ADR-0005 は year/2025 をユーザー定義タグの例として明示しており、実在しうる実タグが年フィルタに化ける。組み込み軸の擬似タグは先頭 @ を予約文字として分離し、実タグが @ で始まることを shared のタグ検証で拒否する。

2. year の複数選択が黙って捨てられる（P2）
2つの年を選ぶと両方がチップとして表示され URL にも載るが、実際は先頭しか適用されない。異なる2年の AND は常に0件なので、year は同時に1つだけ選択でき、新しい年を選ぶと前の選択を置き換える仕様とする。

3. 作品詳細のタグクリックが絞り込みを置き換えなくなった（P2）
LibraryView.tsx の handleTagClick は setAxis("tag") → toggleTag(tag) の2段呼び出しだが、TASK-180 で setLibraryAxisAtom がタグをクリアしなくなったため、既存の絞り込みに追加（または既選択なら解除）されてしまう。「そのタグだけを選択した状態」にする単一のアクションを追加して置き換える。

対象: shared のタグ検証スキーマ / client/src/features/library/model/libraryPresentation.ts / libraryNavigationActions.ts / client/src/features/navigation/model/navigationUrl.ts / LibraryView.tsx
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 実タグが @ で始まることを shared のタグ検証が拒否し、その単体テストがある
- [x] #2 組み込み軸 year のフィルタが URL 上 tags=@year/2024 として表現され、復元できる
- [x] #3 実タグ year/2025 を選択したとき、addedAt の年照合ではなくタグ完全一致で絞り込まれる
- [x] #4 year 軸は同時に1値のみ選択でき、別の年を選ぶと前の選択が置き換わる。チップ表示と実際の絞り込みが常に一致する
- [x] #5 作品詳細のタグをクリックすると、既存の絞り込みが何であってもそのタグだけを選択した状態になる
- [x] #6 上記4点の振る舞いが libraryPresentation.test.ts / libraryNavigationActions.test.ts / navigationUrl.test.ts で検証されている
- [ ] #7 pnpm check と pnpm test が通る
<!-- AC:END -->
