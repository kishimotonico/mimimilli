---
id: TASK-447.18
title: Filesのプレビュー幅の上限を利用可能な幅から決める
status: Done
assignee: []
created_date: '2026-09-11 05:35'
updated_date: '2026-09-11 05:59'
labels:
  - bug
  - ui
  - triage
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 486000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー第2回（tmp/uiux-triage-2026-09-11/followup-2.md の D）。useFilePreviewResize.ts の clamp が固定 720px 上限のため、広い画面で 720 を保存した後、レイアウト幅 721〜979px では一覧の最小幅 260px と同居できず横にあふれる。ドラッグ時・復元時の上限をコンテナ幅から一覧の最小幅を引いた値にする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ドラッグ時と保存値の復元時に、プレビュー幅の上限がコンテナ幅から一覧の最小幅を引いた値で制限される
- [x] #2 720px を保存した状態でウィンドウ幅を 800〜980px にしても、一覧が最小幅を保ちページが横にあふれない（実機で数値確認）
- [x] #3 コンテナ幅の変化（ウィンドウリサイズ）にも追従する
- [x] #4 変更範囲のテストが通り、既存テストの期待値を辻褄合わせで削除・緩和していない（仕様変更で書き換えた期待値はタスクメモに前後を列挙）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ResizeObserverで.mle-files-layout（一覧+プレビューの親）の幅を追跡し、実効上限=containerWidth-一覧最小幅(260px、files-c.cssの.mle-filestage min-widthに合わせてFILES_LIST_MIN_WIDTHとして定義)で、下限はFILES_PREVIEW_WIDTH_MIN(320)を割らないようにclampする関数getEffectiveFilesPreviewWidthMaxを追加。ドラッグ中・復元時（atomのstored値はそのまま保持しdisplayWidthだけ都度clamp）の両方に適用。atomを書き換えないためウィンドウを広げ直すと保存していた幅にそのまま戻る（実機確認済み）。実機確認（fixture new-work、900px幅）: 修正前は.mle-prv-anchorのright(1036px)がviewport(900px)を136px超えて可視域外にクリップされていた（scrollWidthは900のまま＝オーバーフローがスクロールでなくクリップで隠れる形で発生）。修正後はanchor.right=900、.mle-filestage.width=260を維持。800/950/980pxでも一覧260px維持・overflowなしを確認。1440pxに戻すと保存値720pxがそのまま復元されることも確認。スクショ: tmp/uiux-triage-2026-09-11/shots-intake/447.18-before.jpg, -after.jpg（900px幅、修正前後の一時git stashで比較）。純粋関数テスト: client/tests/unit/previewLayoutAtoms.test.ts を新規追加。
<!-- SECTION:NOTES:END -->
