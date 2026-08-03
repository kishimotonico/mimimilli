---
id: TASK-174
title: リストの作品未選択時の右ペインを発見ダッシュボードに差し替える
status: Done
assignee:
  - '@claude'
created_date: '2026-08-02 16:12'
updated_date: '2026-08-02 16:36'
labels:
  - client
  - feature
dependencies: []
priority: medium
ordinal: 184000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DRAFT-8を要件確定してタスク化（2026-08-03、統括判断）。

リスト表示で作品未選択のとき、右ペイン（PreviewPane mode==="empty" かつ showNoResultsHint===false の CollectionPlaceholder）が「作品を選択してください」だけで空白になっている。ここを発見系ダッシュボードに差し替え、探索の起点にする。

## 確定要件

表示セクションは3つ。意匠は AxisLanding.tsx の mll-related カード（CoverImg 80px + タイトル + メタ行）を流用する。

1. 最近追加: GET /api/works?sort=added-desc&limit=6
2. 最近再生: GET /api/works?sort=last-played&view=recent&limit=6。再生履歴が0件ならセクションごと非表示
3. ランダムピック: GET /api/works?sort=random&limit=6（seedはclient側で生成しqueryKeyに含める）。セクション見出し横にシャッフルボタンを置き、押すとseedを引き直す

- カードクリックで onSelectWork（既存の選択経路）
- showNoResultsHint===true（検索0件）のときは従来どおり CollectionPlaceholder を出す
- 既存の emptyStats（コレクション統計）はダッシュボード下部に控えめに残す
- Query購読は新コンポーネント内に置く（TASK-124の方針: Appに持ち上げない）
- ローディングはCollectionStatus等の既存パターン、エラーはセクション単位で表示し隠蔽しない
- グリッドモードには影響しない（差し替え位置がリスト系の右ペインのみのため自然に満たされる）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 作品未選択・非検索時の右ペインに最近追加/最近再生/ランダムの3セクションがmll-relatedカードで表示される
- [x] #2 再生履歴が無い場合、最近再生セクションが非表示になる
- [x] #3 シャッフルボタンでランダムピックが引き直される
- [x] #4 カードクリックで作品が選択され詳細が表示される
- [x] #5 検索0件時は従来の『作品が見つかりません』表示が維持される
- [x] #6 pnpm checkとpnpm testが全パスする
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
【2026-08-03 実装完了】Sonnetサブエージェントへ委譲、統括レビュー・Cursorによるagent-browser実機検証済み（全項目OK、consoleエラーなし）。DiscoveryDashboard.tsx新設、PreviewPaneのempty分岐で差し替え。データ取得はfeatures/library/api.tsのsearchWorks再利用、セクションごとにuseQuery購読（TASK-124方針）。シャッフルはI.refresh流用（Shuffleアイコンはlucide未追加のため）。単体テスト6件追加。

補足: fixtureデータ（RJ501001〜の連番ID）ではstableRandomSortKeyのhex回転がIDの末尾差しか動かさないため、seedを変えてもランダムピックの並びがほぼ変わらない。実運用のUUID v4では正常にシャッフルされる。fixture固有の見え方でTASK-174のバグではない。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
リスト未選択時の右ペインを発見ダッシュボード（最近追加・最近再生・ランダムピック各6件、mll-relatedカード意匠）へ差し替え。最近再生は履歴0件で非表示、ランダムはシャッフルボタン付き、検索0件時は従来表示を維持。pnpm check・pnpm test（server 445/client 611）全パス、ブラウザ実機検証OK。
<!-- SECTION:FINAL_SUMMARY:END -->
