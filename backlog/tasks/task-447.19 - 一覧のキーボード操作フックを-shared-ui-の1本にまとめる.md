---
id: TASK-447.19
title: 一覧のキーボード操作フックを shared/ui の1本にまとめる
status: Done
assignee: []
created_date: '2026-09-11 08:05'
updated_date: '2026-09-11 08:25'
labels:
  - refactor
  - triage
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 487000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計負債の返上 第3回（tmp/uiux-triage-2026-09-11/followup-3.md の1）。useGridKeyboardNav（グリッド／ジャスティファイド、仮想化）、useWorkListKeyboardNav（1列、仮想化）、useFileListKeyboardNav（1列、非仮想化）がほぼ同形で、features 間で共有できず files に複製されている。shared/ui/useListKeyboardNav.ts に1本化する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 shared/ui/useListKeyboardNav.ts が columnCount・justifiedTiles（{rowIndex, centerX} の配列）・virtualizer（省略可）を受け、グリッド・ジャスティファイド・1列・非仮想化の全ケースを扱う
- [x] #2 旧フック3本が削除され、WorkGrid・AxisValueGrid・WorkListPane・Files の一覧が新フックを使っている。削除したファイルへの参照がない
- [x] #3 shared から features への依存がない（JustifiedLayout 型等を shared に持ち込まない）
- [x] #4 フック単体テストが1本に統合され、旧3本のテストが縛っていた性質（端のクランプ、Home/End、仮想化時のスクロール、非仮想化時の即時フォーカス等）がすべて残っている
- [x] #5 挙動は変わらず、既存テストの期待値を変えていない（テストの統合・名前変更だけ許容し、タスクメモに列挙）。pnpm check（レイヤー境界含む）・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装完了。差分一覧・テスト対応表:

- shared/ui/useListKeyboardNav.ts を新設。引数は containerEl・items・columnCount・justifiedTiles?・virtualizer?・onFocusItem。justifiedTiles有無でgetNextJustifiedIndex/getNextGridIndexを、virtualizer有無でfocusVirtualItem内の分岐（scrollToIndex+rAFリトライ / 即時focus）を切り替える。
- shared/lib/focusVirtualItem.ts: virtualizer引数をnullable化し、無ければ即時focus（旧useFileListKeyboardNavの挙動）へ分岐を集約。
- shared/lib/gridNavigation.ts: JustifiedTilePosition型をexport（新フックがimportするため）。他の関数シグネチャは不変。
- WorkGrid.tsx / AxisValueGrid.tsx: useGridKeyboardNav→useListKeyboardNav。isJustified&&justifiedLayoutの合成はjustifiedTiles: isJustified ? (justifiedLayout?.tiles ?? null) : null で完全再現（isJustified=trueだがlayout未計算時はgetNextGridIndexへフォールバックする旧挙動も保持）。
- WorkListPane.tsx: useWorkListKeyboardNav→useListKeyboardNav。containerElを値渡しする仕様に合わせ、scrollRef（useVirtualList由来）とは別にuseState<HTMLDivElement|null>を追加し、callback ref（setListContainer）でscrollRef.currentとstateの両方に書く。columnCount:1、onFocusItem: (work)=>onWorkSelect(work.id)。
- FileColumn.tsx: useFileListKeyboardNav→useListKeyboardNav。useRef→useState<HTMLDivElement|null>に変更（containerElを値で渡すため）。columnCount:1、virtualizer省略、onFocusItem: (entry)=>onFocusEntry(entry.path)。
- 旧3フック（features/library/ui/useGridKeyboardNav.ts, features/library/ui/useWorkListKeyboardNav.ts, features/files/ui/useFileListKeyboardNav.ts）はgit rmで削除。参照ゼロを確認済み（rg検索）。

テスト対応表:
- client/tests/unit/useGridKeyboardNav.test.ts（2ケース: rowIndex解決→focus+scrollToIndex / rowIndex undefined→何もしない）→ client/tests/unit/useListKeyboardNav.test.ts に統合・移植（同じ2ケースを維持）。
- 新規追加ケース（旧3フックがコンポーネント統合テストでしか間接的に縛れていなかった性質を、フック単体でも直接縛るため追加）: 端のクランプ（ArrowLeftでnextIndex===currentIndex→何もしない）、justifiedTiles経由でgetNextJustifiedIndexへ実際にルーティングされること、virtualizer省略時の即時focus（scrollToIndex不呼び出し）、containerEl nullで何もしない。
- client/tests/unit/gridNavigation.test.ts（純粋関数のテスト）は無変更。
- client/tests/unit/WorkGrid.test.tsx・FileColumn.test.tsx（矢印キーの統合テスト）は無変更のまま全ケース green（新フック経由での回帰を確認）。useWorkListKeyboardNav・WorkListPaneには元々矢印キーの単体/統合テストが無かった（新設もしていない。実機確認で代替）。

実機確認（agent-browser, --session 447-19, worktree fixture dev server, http://447-19.mimi.localhost:1355）:
- 作品リスト（WorkListPane, columnCount=1・仮想化）: ArrowDown 0→1→2, End→10, Home→0, ArrowUp(先頭)→クランプ
- 作品グリッド 1:1（WorkGrid, columnCount=5・仮想化）: ArrowRight 0→1, ArrowDown 1→6, End→10, Home→0
- 作品グリッド ジャスティファイド（WorkGrid, justifiedTiles・仮想化）: ArrowRight 0→1, ArrowDown 1→7, End→10, Home→0
- 値一覧グリッド（AxisValueGrid, 非virtualizer引数のcolumnCount・仮想化）: ArrowRight 0→1, End→2, Home→0, ArrowUp(先頭)→クランプ
- Files一覧（FileColumn, columnCount=1・非仮想化）: ArrowDown 0→1, End→5, Home→0
全て問題なし。

check/test/smoke:
- pnpm check: 全緑（layer boundaries含む）
- pnpm test: pnpm経由のrun-pで実行すると既知のサンドボックス事情（server: bun test --parallelでのDB close競合、client: vitestのネイティブクラッシュ）で失敗するが、本タスクの変更とは無関係。個別に直接実行すると client: npx vitest run → 154 files / 1102 tests all green、server: bun test tests（--parallel無し）→ 796 tests 0 fail で確認済み。
- pnpm test:smoke: 25/25 green
<!-- SECTION:NOTES:END -->
