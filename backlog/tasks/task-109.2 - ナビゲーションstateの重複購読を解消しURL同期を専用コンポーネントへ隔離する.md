---
id: TASK-109.2
title: ナビゲーションstateの重複購読を解消しURL同期を専用コンポーネントへ隔離する
status: To Do
assignee: []
created_date: '2026-07-27 01:55'
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
- [ ] #1 App.tsx が useLibraryView / useFilesNavigation / useNavigationHistory を直接呼んでいない
- [ ] #2 作品選択・タグ切替・軸切替のいずれでも App が再レンダリングされない
- [ ] #3 URLとの相互同期（アドレスバー・ブラウザーの戻る/進む・リロード復元）が従来どおり動作する
- [ ] #4 戻る/進むボタンの活性状態が従来どおり反映される
<!-- AC:END -->
