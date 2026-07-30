---
id: TASK-109.2
title: ナビゲーションstateの重複購読を解消しURL同期を専用コンポーネントへ隔離する
status: Done
assignee: []
created_date: '2026-07-27 01:55'
updated_date: '2026-07-27 12:53'
labels: []
dependencies:
  - TASK-109.1
parent_task_id: TASK-109
priority: high
ordinal: 115000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
App がナビゲーション state をルート購読しているのをやめる。

現状:
- App.tsx:56 が useLibraryView() を呼び、library のナビ atom 5種（activeAxis / drillValue / selectedTags / selectedWorkId / sort）を購読している。LibraryView.tsx:58 でも同じフックを呼んでいて二重購読
- useNavigationHistory.ts:70-78 が library の5 atom に加えて files の relPath / selectedPath / commit atom も購読している。App がこのフックを呼ぶ限り、作品選択やタグ切替で App が再描画される

方針:
- useLibraryView() / useFilesNavigation() の購読をモード別コンポーネント（LibraryView / FilesView）に閉じる。App が必要とするのは addressPath と数個の setter だけなので、AddressBar 側で購読する
- URL同期を行う useNavigationHistory は NavigationHistorySync のような null 描画コンポーネントへ移し、購読を隔離する。back / forward / canBack / canForward は AddressBar が使うので、この state だけを別 atom か薄いフックで公開する
- App の mode state（useState）と atom に分かれているナビゲーション state の置き場を揃えるかは実装時に判断してよい
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 App.tsx が useLibraryView / useFilesNavigation / useNavigationHistory を直接呼んでいない
- [x] #2 作品選択・タグ切替・軸切替のいずれでも App が再レンダリングされない
- [x] #3 URLとの相互同期（アドレスバー・ブラウザーの戻る/進む・リロード復元）が従来どおり動作する
- [x] #4 戻る/進むボタンの活性状態が従来どおり反映される
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. appModeAtom を新設し、App の mode useState を置き換える（初期値は parseNavigationUrl でモジュール初期化。従来の no-flash 挙動を維持）
2. ナビゲーション操作を write-only atom（atom(null, (get,set,arg)=>...)）として切り出す。呼び出し側が state を購読せずに操作だけできるようにする: librarySetAxis / librarySelectWork / librarySetSort / libraryGoToSegment / filesGoToSegment / setAppMode。useLibraryView / useFilesNavigation はこれらを合成する形にして実装の二重化を避ける
3. useNavigationHistory の引数（mode / setMode / rootFolder）を廃止し、自身で appModeAtom と settings query（同一 queryKey なので追加リクエストは発生しない）を読む。canBack / canForward は navigationHistoryStateAtom で公開する。back / forward は window.history を呼ぶだけなのでモジュール関数にする
4. NavigationHistorySync（null を返すコンポーネント）を新設して useNavigationHistory の購読を隔離し、App から描画する
5. AddressBar を購読単位で分解する。Breadcrumbs（表示専用）/ LibraryBreadcrumbs / FilesBreadcrumbs / LibrarySortMenu / NavigationHistoryButtons。AddressBar 自身は appModeAtom だけ購読して組み立てる
6. LeftNav が appModeAtom を購読し、setAppMode を直接使う
7. App から useLibraryView / useFilesNavigation / useNavigationHistory と mode useState を削除。body の分岐に必要な appModeAtom のみ購読する（モード切替で App が再描画されるのは正当）
8. pnpm check / pnpm test / ビジュアルテストを通し、一時計装でのレンダー計測で AC#2 を確認する（陰性・陽性対照つき）

スコープ注記: 手順5は TASK-115（AddressBar の library/files 分離）と一部重なる。App をナビゲーション state から切り離すには AddressBar が自分で購読する必要があるため、このタスクで先に行う。TASK-115 は残りの props 整理に縮小する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装完了（Cursorへ委譲 + 統括側で修正）。

新規: navigationAtoms.ts / libraryNavigationActions.ts / filesNavigationActions.ts / NavigationHistorySync.tsx / Breadcrumbs.tsx / LibraryBreadcrumbs.tsx / FilesBreadcrumbs.tsx / LibrarySortMenu.tsx / NavigationHistoryButtons.tsx / useSettingsQuery.ts
変更: App.tsx / AddressBar.tsx / LeftNav.tsx / useLibraryNavigation.ts / useFilesNavigation.ts / useNavigationHistory.ts / navigationHistoryAtoms.ts / files/model/atoms.ts

統括側の修正:
- useNavigationHistory が currentIndex / maxIndex を useState で持ち effect で atom へ写す形になっていた。まさに排除対象の「state → effect → atom」二重管理でナビゲーションごとに余分なレンダーが1往復増えるため、ref を唯一の保持先として publishHistoryState() に統一し useState 2つと effect 1つを削除
- settings クエリのオプション（retry: 1）が App / useNavigationHistory / FilesBreadcrumbs の3箇所に散ったため useSettingsQuery / useRootFolder へ集約（観測者ごとにオプションが食い違う事故を防ぐ）
- useNavigationHistory の戻り値型を null から void へ、未使用 import の除去

Codex レビューの指摘（P2）を反映:
- appModeAtom の初期値をモジュール読み込み時に評価していたため、Jotai の Provider を作り直すと新しいストアでも最初のURLのモードが使われ、テストが実行順に依存する問題があった。jotai/utils の atomWithLazy へ変更し、ストアごとの初回読み取り時に評価する形にした（初回描画で誤ったビューをマウントしない従来の利点は維持）
- 退行防止に tests/unit/navigationAtoms.test.ts を追加。修正前の実装では expected 'library' to be 'files' で落ちることを確認済み

検証:
- pnpm check 通過、pnpm test 通過（全体340件 / client 313件）
- ビジュアルテスト 6/6 パス、スナップショット変更なし
- レンダー計測（一時計装 + StrictMode で表示値は論理レンダー数の2倍。計測後に撤去）:
  - アイドル5秒: {} （背景ノイズなし）
  - 軸切替: LibraryView 4 / AxisColumn 4 / ContentColumn 4 / NavigationHistorySync 2
  - 作品選択: 同上
  - タグ絞り込み: LibraryBreadcrumbs 2 / Breadcrumbs 2 / LibraryView 4 / AxisColumn 4 / ContentColumn 4 / NavigationHistorySync 2 / NavigationHistoryButtons 2
  - いずれも App / TopBar / LeftNav / PlayerDock は 0 → AC#2 達成
  - 操作ごとに再レンダー対象の集合が異なることが、計装が per-component に正しく数えている証拠になっている
- ブラウザ検証: 履歴は /library/all → /library/cv → /library/cv/藤田茜 → ?work=<id> と前進し、戻る2回・進む2回で正しく遷移。作品選択が replace コミットで履歴を増やさない既存仕様も維持。戻る/進むの disabled が境界で正しく切り替わる。ファイルモードは /files/<dir>?sel=<path> で階層と選択が URL に乗り、パンくずのルート名が mimimilli-root と正しく表示される（settings クエリ経由に変えた影響で / に化ける懸念はなかった）

設計の要点: URL 同期は全ナビ atom を購読する必要があるが、null を返す NavigationHistorySync に隔離したことで、その購読コストが App ツリーへ波及しなくなった。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ナビゲーション state の購読を App.tsx から下位コンポーネントへ降ろした。

App から useLibraryView / useFilesNavigation / useNavigationHistory の呼び出しと mode の useState を取り除き、(1) appModeAtom（atomWithLazy でストアごとにURLから初期化）、(2) ナビゲーション操作を write-only atom として切り出し（write 関数内の get は購読を発生させないため呼び出し側が再レンダーされない）、(3) URL同期を null 返却の NavigationHistorySync へ隔離、(4) AddressBar を購読単位に分解（props ゼロになった）、の4点で置き換えた。既存の useLibraryView / useFilesNavigation は write-only atom を合成する薄いラッパーへ書き換え、ロジックの二重化は避けた。

検証: pnpm check / pnpm test（340件 / client 313件）通過、ビジュアルテスト 6/6。一時計装によるレンダー計測で、軸切替・作品選択・タグ絞り込みのいずれでも App / TopBar / LeftNav / PlayerDock が0回（AC#2 達成）。ブラウザで履歴の前進・後退・disabled 状態・リロード復元・ファイルモードの階層とURL同期・パンくずのルート名を確認。Codex レビューの P2 指摘（appModeAtom のモジュール評価時初期化によるテストの実行順依存）を atomWithLazy で修正し、退行防止テストを追加した。
<!-- SECTION:FINAL_SUMMARY:END -->
