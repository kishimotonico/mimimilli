---
id: TASK-428.11
title: スマートフォルダー条件の検証・意味表示を統一する
status: To Do
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 13:20'
labels:
  - ui
  - smart-folder
  - validation
dependencies: []
modified_files:
  - client/src/features/library/ui/SmartFolderEditorModal.tsx
  - client/src/features/library/ui/preview/SmartFolderView.tsx
parent_task_id: TASK-428
priority: high
ordinal: 438000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
smart-folders-A-04/A-06/A-11/A-13/A-17とB重複。保存失敗時に画面外の原因へ移動せず、WHERE/AND NOTや演算子・時間表記も画面間で揺れる。条件エディタと結果バナーの表現を共通化する。

決定（DRAFT-74 Q-03, 2026-09-07）: 結果バナーの件数は「条件一致 N件」と「絞り込み後 M件」に分ける。編集中のライブ件数プレビューを実装し、保存前のルールを受け取って件数を返す専用の評価API（`POST /smart-folders/preview` 相当）を新設する。300ms debounce、ルールが妥当なときだけ件数を表示、集計中は「集計中…」を出す。「＋絞り込み」候補の件数と性能測定は TASK-428.24 で扱う。

AC #4の具体化: 演算子・期間・長さの表示文言を単一のformatterに集約し、条件エディタと結果バナーが同じ関数から文言を生成する。代表パターン（等価・不一致・以上／以下・期間・長さ）で両画面の文字列が一致することをテストで確認する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 保存失敗時にエラー件数を表示し、最初の不正入力へscrollとfocusを移す
- [x] #2 不正入力と条件カードがaria-invalidと視覚表示で判別できる
- [x] #3 接続詞列が揃いWHEREとAND NOTが見切れない
- [x] #4 pnpm test:smokeに新規失敗がない
- [x] #5 演算子・期間・長さの文言を単一formatterに集約し、代表パターンでエディタと結果バナーの文字列が一致する
- [x] #6 結果バナーが「条件一致 N件」と「絞り込み後 M件」を分けて表示する
- [x] #7 条件編集中にライブ件数プレビューが出る（評価APIを新設、300ms debounce、妥当なルールのみ件数表示、集計中は「集計中…」）
<!-- AC:END -->
