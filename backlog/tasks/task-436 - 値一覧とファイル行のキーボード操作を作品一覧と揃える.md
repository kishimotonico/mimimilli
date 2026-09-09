---
id: TASK-436
title: 値一覧とファイル行のキーボード操作を作品一覧と揃える
status: Done
assignee: []
created_date: '2026-09-07 19:58'
updated_date: '2026-09-09 16:28'
labels:
  - ui
  - keyboard
  - a11y
dependencies: []
ordinal: 457000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
responsive-keyboard-A-02。矢印キーが効く一覧と効かない一覧が混在している。TASK-428.12 が作品グリッド・作品リスト・トラック一覧に roving tabindex と矢印キー・Home/End・Enter再生・Escape選択解除を実装したが、監査所見 responsive-keyboard-A-02 の files 欄が挙げる AxisValueRows.tsx / AxisValueGrid.tsx / AxisValueQuickList.tsx / FileRow.tsx / FileColumn.tsx は TASK-428.12 の Modified files 欄の範囲外だったため未対応で残っている。値一覧側は現状 onKeyDown が皆無。

TASK-428.12 が新設した共通実装（client/src/features/library/model/gridNavigation.ts の Home/End 対応、client/src/features/library/ui/useWorkListKeyboardNav.ts、useWorkResultsDismiss.ts、client/src/shared/lib/focusVirtualItem.ts）を再利用し、独自実装を作らないこと。契約は docs/design-system.md に明文化済み。

TASK-428.13 のグローバルショートカット契約（SHORTCUT_EXEMPT_SELECTOR、Escape の階層、data-player-control）と衝突させないこと。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 値一覧（AxisValueRows・AxisValueGrid・AxisValueQuickList）で矢印キー・Home/Endが作品一覧と同じ規則で動く
- [x] #2 ファイル一覧（FileRow・FileColumn）で矢印キー・Home/Endが作品一覧と同じ規則で動く
- [x] #3 各一覧がroving tabindexで、Tab一回で入り一回で抜けられる
- [x] #4 gridNavigation.ts・useWorkListKeyboardNav.ts・focusVirtualItemを再利用し、キーボード操作の実装が重複していない
- [x] #5 pnpm test:smokeに新規失敗がない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 仕様変更の記録（オーナー承認済み）

### AxisValueQuickList/AxisValueRowsの矢印キー境界挙動をクランプへ変更
矢印キーの端（先頭/末尾）の挙動を、従来のラップアラウンド（先頭でArrowUp→末尾へ、末尾でArrowDown→先頭へ）から、作品一覧（WorkRow/WorkTile、getNextGridIndex）と同じクランプ（端で留まる）へ揃えた。Home/Endが新設されたため、ラップアラウンドは不要と判断（オーナー承認）。

条件: 「位置未確定（activeIndexRef=-1）の状態からのArrowDown→先頭の値行へ着地」は維持している（検索欄からリストへ入る唯一の導線のため）。確認済み・変更なし。「位置未確定からのArrowUp→何も起きない」は変更後の挙動（旧: 末尾へ着地）。

対象テスト: client/tests/unit/AxisValueQuickList.test.tsx（既存2件の期待値変更）

### Filesの矢印キー移動＝プレビュー対象の追従（フォルダーへは潜らない）
FileColumn/FileRowの矢印キー移動は、クリックと異なりフォルダーへ潜らず、プレビュー対象（selectedPath）だけを追従させる。Finder等の物理ファイラーと同じ規則、かつ作品一覧の矢印キー移動が選択を追従させる規則と一貫性を優先（オーナー承認）。

確認: プレビュー取得のキャッシュ状況を実機計測。
- 画像(<img src>)・動画(<video src>): ブラウザのHTTP キャッシュが効き、A→B→A往復で追加のネットワークリクエストは発生しない（ネットワークログで確認）
- テキスト（TextMedia.tsx の手動fetch、TanStack Query不使用）・PDF（ブラウザ内蔵PDFビューアへのDocumentナビゲーション）: 往復のたびに再取得が発生する。これはTASK-436以前からの既存実装（TanStack Queryでラップされていない）であり、矢印キー導入によって新規に生じた挙動ではない。連打で再取得頻度が上がる点は仕様上の帰結として残る
- 対応: 今回は入れない（作品一覧と同じ性質なのでfilesだけdebounceを入れると規則が割れるため）。体感で問題が出た場合は、作品一覧と共通の場所（選択確定タイミングを扱う共有フック）で一括対応する方針

Files プレビューの連続再取得について（2026-09-10、オーナー判断）: 矢印キー移動でプレビュー対象が追従する設計に伴い、テキスト・PDF は往復のたびに再取得が発生する（画像・動画はブラウザHTTPキャッシュで再取得なし）。TASK-436 以前からの既存挙動で、FilePreview.tsx が TanStack Query を使っているのは singleFileWorkQuery だけ、メディア本体は TextMedia.tsx の素の fetch とブラウザ内蔵PDFビューアへの Document ナビゲーションのため。files だけ debounce を入れると作品一覧と規則が割れるので本タスクでは対応しない。related: TASK-446（プレビュー用メディアを検証型HTTPキャッシュに寄せ往復再取得をなくす）で対応する。
<!-- SECTION:NOTES:END -->
