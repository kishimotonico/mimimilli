---
id: TASK-516.5
title: 今のシェルのまま、ライブラリのデータ層をスマートフォルダーと新しい URL に切り替える
status: Done
assignee: []
created_date: '2026-11-21 20:24'
updated_date: '2026-11-22 09:51'
labels:
  - library
  - ui
dependencies:
  - TASK-516.3
  - TASK-516.4
documentation:
  - docs/adr/0041-library-sidebar-shell-navigation.md
  - docs/adr/0040-smart-folder-condition-tree.md
parent_task_id: TASK-516
priority: high
ordinal: 606000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
見た目（LeftNav・軸レール）は変えずに、データと遷移だけを ADR-0040・0041 に替える段。不具合の出どころを切り分けやすくするため、画面の作り替えより先に行う。軸レールにはスマートフォルダー一覧（サーバーの順と件数）を並べる。URL は /library/<folderId>?group=&tags=&q=&work=（sort は URL から外す）。resolveLibraryView（ADR-0041）を置き、isViewAxis・isSmartAxis・computeResultsPaneKind などの分岐をこの結果を読む形に置き換える。並びの2層（今の並びは履歴エントリー、解決順は 今の並び→スマートフォルダーの既定→「すべて」の既定、並び順メニューの「この並びを既定にする」）、ランダムの「並べ直す」、スマートフォルダーの切り替えでチップと検索語を消すこと、行き先の規則（タグクリック・Ctrl+クリック・値一覧からの追加・値一覧での検索・0件時の「『すべて』で探す」・パンくずの兄弟値）もここで入れる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ライブラリの一覧・値一覧・件数がスマートフォルダーの API だけから取られ、URL が ADR-0041 の表の形になる（sort は URL に出ない）
- [x] #2 resolveLibraryView が、存在しない ID は all へ、グループ分けの無いものの group は無視、値一覧では q・tags を効かせない、読めない行は開けない状態、を返し、単体テストがある
- [x] #3 並び順メニューの変更は今の並びとして戻る・進む・作品詳細からの戻りで保たれ、サイドバーから入り直すと既定に戻る。外れているときだけ「この並びを既定にする」が出て、押すと既定が保存される
- [x] #4 「『すべて』と同じ」のスマートフォルダーが「すべて」の既定の並びの変更に従う
- [x] #5 タグクリック・Ctrl+クリック・クイックオーバーレイの追加・検索欄の入力の行き先が ADR-0041 の表どおりで、0件時に「『すべて』で探す」が出る
- [x] #6 ランダムは開いている間（ページ送り・詳細から戻る・お気に入り後の再取得）順序が変わらず、入り直しと「並べ直す」で変わる
- [x] #7 library.smoke を新しい URL と挙動に直して通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
516.1 レビューからの引き継ぎ: 0件で隠す判定（isHiddenWhenEmpty）は候補の判定だけ。ADR-0040「件数」のデータ不整合の件数はスマートフォルダー一覧の応答に無いので、どこから取るか（ADR-0039 の診断の口など）をこの段か 516.7 で決める。

516.4 からの引き継ぎ: useRouteHistorySync は「push 指定でも URL が同じなら replace」に落ちる。サイドバーから同じスマートフォルダーへ入り直す（sort: null と新しい seed）操作が push か replace かをこの段で決めて実装する。履歴エントリーの sort・seed は mode: library のエントリーからだけ読み戻す（516.4 で決定）。

516.5 実装メモ: (1) サイドバー入り直し(openLibraryFolder/openLibraryGroupValue)は push 指定。同一 URL なら同期が replace に落とし、その場で既定の並びと新しい seed にリセットされる。(2) 値一覧・読めない行を保持しているときの Ctrl+クリック/追加/検索は「すべて」へ push。(3) 0件で隠す処理は未実装(全行出す)。データ不整合の件数の出どころは 516.7 のまま。(4) 旧スマートフォルダーのエディタ・条件サマリー(SmartFolderView)は呼び出しを外し、.trash-TASK-516.5 へ退避した。結果面のデータ不整合バナーは条件が hasError だけのフォルダーでだけ出す。(5) shared/library.ts の旧 smartFolderSchema 等は 516.6 で削除。
<!-- SECTION:NOTES:END -->
