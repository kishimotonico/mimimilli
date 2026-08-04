---
id: TASK-185
title: スマートフォルダー表示中も保持中のフィルタを結果に適用する
status: In Progress
assignee:
  - impl-184
created_date: '2026-08-04 11:36'
updated_date: '2026-08-04 12:56'
labels: []
dependencies:
  - TASK-184
priority: high
ordinal: 195000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codex レビュー（2026-08-04）で見つかった TASK-180 の欠陥。ADR-0012 §1 により軸を切り替えても絞り込みが維持されるようになったが、スマートフォルダー軸へ切り替えたとき、結果面にはチップが表示されるのに useSuspenseSmartLibraryWorks はフォルダーIDとページングだけで問い合わせるため、フィルタが結果に一切効いていない。UIがユーザーに嘘をついている状態。

スマートフォルダーの評価にタグAND絞り込み（および組み込み軸のフィルタ）を重ねられるようサーバー側の評価APIとクライアントのクエリキーを拡張する。フィルタはフォルダーのルールに対する追加のAND条件として適用する。

対象: スマートフォルダー評価API（server）/ client/src/features/library/model/useLibraryQueries.ts の useSuspenseSmartLibraryWorks とクエリキー / 結果面のチップ表示

関連: TASK-146（スマートフォルダー表示中のソートメニューの扱い）と設計上つながるので、着手時に整合を確認すること。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 スマートフォルダー軸でタグを絞り込むと、フォルダーのルールと選択タグの AND で結果が絞られる
- [x] #2 組み込み軸のフィルタ（year）もスマートフォルダーの結果に適用される
- [x] #3 フィルタを変更するとクエリキーが変わり、キャッシュが正しく分離される
- [x] #4 チップ列に表示されているフィルタと実際の結果が一致している（表示だけで効かないフィルタが存在しない）
- [x] #5 スマートフォルダー評価APIの契約変更が shared に反映され、real と fixture の両アダプタで同一に動く
- [x] #6 pnpm check と pnpm test が通る
<!-- AC:END -->
