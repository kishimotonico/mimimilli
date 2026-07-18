---
id: TASK-33.3
title: 'クライアント: 軸レール動的化・タグ編集解禁・タグ設定UI'
status: Done
assignee: []
created_date: '2026-07-10 19:38'
updated_date: '2026-07-11 15:58'
labels: []
dependencies:
  - TASK-33.2
parent_task_id: TASK-33
priority: high
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
クライアントをprefix定義ベースへ移行する。

## 内容
- 軸レール（AxisColumn）の分類軸をGET /tag-prefixesのshowAsAxis=trueから動的生成（＋組み込みのtag/year）。axisDefinitions/types/navigationUrlのenum前提を撤廃（予約ID以外のpathセグメントはprefix軸として受ける）
- タグ編集の解禁: 構造化タグも追加・削除可能に（useWorkTagEditor/editableTagsの「構造化=編集不可」を廃止）。protectedなprefixのタグ削除時は確認ダイアログ（docs/design-system.mdの規約に従う）
- Tag.tsxのラベル・色ハードコードをprefix定義参照に置き換え（未登録prefixは現行のフォールバック表示）
- 設定モーダルに「タグ設定」セクション: 定義一覧（label・軸表示・保護のトグル、削除）、追加フォーム、candidatesからのワンクリック登録
- URL同期・ドリル・AxisLandingが動的軸で動くこと
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 登録prefixの軸が軸レールに現れ、ドリル・URL直叩き・戻る進むが動く
- [x] #2 cv/サークルタグをWorkDetailから削除でき、削除時に確認ダイアログが出る
- [x] #3 構造化タグ（例: cv/新人）を追加できる
- [x] #4 設定UIでprefixの追加・編集・削除と候補からの登録ができる
- [x] #5 year軸（追加日）のドリルで該当年の作品が表示される
- [x] #6 pnpm checkとclientテストが通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
軸レールをGET /tag-prefixesから動的生成（AxisId文字列化・URLパーサー動的化）、タグ編集を全タグに解禁し保護prefixはConfirmDialogで確認、Tag.tsxをprefix定義参照に、設定モーダルにタグ設定セクション（CRUD+候補登録）を追加。agent-browserで軸ドリル・日本語prefixのURL直叩き・保護確認ダイアログ・undo・prefix追加の軸レール即時反映を実機確認。unit 140件・visual 6件グリーン（ベースライン3枚更新）
<!-- SECTION:FINAL_SUMMARY:END -->
