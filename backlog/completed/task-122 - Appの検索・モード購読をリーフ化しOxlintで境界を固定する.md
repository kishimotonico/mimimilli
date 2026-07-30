---
id: TASK-122
title: Appの検索・モード購読をリーフ化しOxlintで境界を固定する
status: Done
assignee: []
created_date: '2026-07-28 16:26'
updated_date: '2026-07-29 16:01'
labels: []
dependencies:
  - TASK-121
priority: medium
ordinal: 132000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-109 完了後の総合レビュー（Fable が検出、GPT-5.6-Sol がスコープを精緻化）。

問題:
App.tsx はなお searchQuery と activeModal を保持し、子は全て素の element prop で memo はゼロ。つまり App が1回レンダーされると全ツリーが再レンダリングされる。

本質は「memo ゼロ設計は『App がほぼレンダーされない』という単一の前提に全面依存している」こと。App に state を1つ足すだけで TASK-109 以前の全体再描画が静かに復活し、それを検出できる回帰テスト（appRootSubscriptions.test.tsx）は player / notification summary / appMode の3系統しか見張っていない。

searchQuery を降ろす理由:
実質的には TopBar と LibraryView を接続するためだけに App を経由している。消費者が離れた2 leaf なので atom の正用途。検索確定ごとに AppShell 全体を再生成する必要はない。activeModal は低頻度・排他・App 所有の UI なので App ローカルのままでよい（TASK-109.5 の結論を維持）。

付随して見つかった仕様の穴:
files モードでも「このフォルダー内を検索」と表示されるが FilesView は検索値を利用していない。files 検索は未実装。実装しないなら files モードでは検索欄を隠す。

Oxlint 制約について:
本プロジェクトの lint は oxlint（package.json の oxlint --deny-warnings、.oxlintrc.json）。overrides + no-restricted-imports（paths + importNames）で実現でき、カスタムルールは不要。Fable が一時 config で実地検証済み。

ただし「App が購読 API を import すると lint で落ちる」という条件は広すぎる。no-restricted-imports は任意の hook が購読するかを判定できず、App には正当なセットアップ系購読も残る。条件は下記 AC の範囲に狭める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 検索入力・IME確定・clear で App が再レンダリングされない
- [x] #2 App.tsx から Jotai の read API と atom/state モジュールを import できない（lintで落ちる）
- [x] #3 App から必要な action API は許可されている
- [x] #4 state と action が同じモジュールに混在している箇所が分割されている
- [x] #5 library / files 往復時の検索語ライフサイクルが仕様どおり
- [x] #6 files モードの検索導線が整理されている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. searchQuery を library feature の session-local atom へ移す。TopBar が read/write、LibraryView が read、clear 操作は write。URL や localStorage には保存しない。library / files のモード切り替え中も検索語は保持する
2. appModeAtom の購読を App から AppBody 等へ降ろす（Oxlint 制約を有効化する前提条件）
3. files モードの検索導線を整理する。files 検索を実装しないなら検索欄を隠す
4. state / action が同じモジュールに混在している箇所を分割する（player の usePlayer.ts が該当する見込み）
5. Oxlint の overrides + no-restricted-imports で境界を固定する。カスタムルールは不要
6. activeModal は App ローカルのまま（TASK-109.5 の結論を維持）
7. テスト: 検索操作で App が再レンダリングされないことの回帰テスト、Oxlint 制約が実際に違反を検出することの確認
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
searchQuery を App の useState から library の librarySearchQueryAtom へ移し、TopBar が read/write、LibraryView が read する形にした。URL・localStorage には保存せず、モード切替を跨いでは保持する。

AppBody.tsx を新設して appModeAtom の購読と body の出し分けを App から降ろした。TopBar が必要とする mode も TopBar 自身が購読する。

usePlayerState.ts / usePlayerActions.ts へモジュール分割し、呼び出し側（PlayerDock / BarContent / PopupContent / FullScreenPlayer / FullScreenPlayerGate / PlayerRuntime）を追従させた。互換 re-export シムは作っていない。

files モードでは検索欄を隠すようにした（FilesView が検索値を使っておらず files 検索は未実装のため。仕様の穴としてレビューで発見された）。

.oxlintrc.json に App.tsx 向けの overrides + no-restricted-imports を追加。jotai の useAtom / useAtomValue と、features/**/model/atoms・*Atoms パターンの import を禁止する。

陽性対照の差し替え: appRootSubscriptions.test.tsx の陽性対照は appModeAtom 更新だったが、App が appModeAtom を購読しなくなったため settings クエリ更新へ差し替えた。App が実際に購読しているものに追随させないと対照が成立しない。

検証:
- pnpm check 通過、pnpm test 通過（server 340 / client 329）
- ビジュアルテスト 6/6、スナップショット差分なし
- Oxlint 制約の実効性を委譲元でプローブ確認: jotai の useAtomValue import で「'useAtomValue' import from 'jotai' is restricted」、atom モジュール import で「import is restricted from being used by a pattern」。いずれも狙いどおり検出。プローブは撤去済み
- 検出力確認: App.tsx に librarySearchQueryAtom の購読を戻すと検索テストが expected 2 to be 1 で失敗。陽性対照も settings 購読を外すプローブで expected 1 to be greater than 1 で失敗し、生存を確認
- ブラウザ実機: 検索の絞り込み・IME 変換中に検索が走らないこと（変換中11件のまま、確定後0件）・clear・0件表示、モード切替を跨いだ検索語保持とリロードで消えること、files モードで検索欄非表示、プレイヤー全操作、バー⇄ポップアップと has-docked-bar、通知ベル・設定・スキャンモーダル、ライブラリ軸切替と作品選択を確認。コンソールのアプリ起因 error/warn は 0 件
<!-- SECTION:NOTES:END -->
