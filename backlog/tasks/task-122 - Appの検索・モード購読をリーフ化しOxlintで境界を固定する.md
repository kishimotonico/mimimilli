---
id: TASK-122
title: Appの検索・モード購読をリーフ化しOxlintで境界を固定する
status: To Do
assignee: []
created_date: '2026-07-28 16:26'
updated_date: '2026-07-28 16:27'
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
- [ ] #1 検索入力・IME確定・clear で App が再レンダリングされない
- [ ] #2 App.tsx から Jotai の read API と atom/state モジュールを import できない（lintで落ちる）
- [ ] #3 App から必要な action API は許可されている
- [ ] #4 state と action が同じモジュールに混在している箇所が分割されている
- [ ] #5 library / files 往復時の検索語ライフサイクルが仕様どおり
- [ ] #6 files モードの検索導線が整理されている
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
