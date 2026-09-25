---
id: TASK-472
title: Filesで単一ファイル形式の作品のID重複を解消できるようにする
status: To Do
assignee: []
created_date: '2026-09-25 14:48'
labels:
  - ui
  - files
  - identity-conflict
dependencies:
  - TASK-467
priority: medium
ordinal: 530000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
背景: TASK-467（ADR-0032）で、ID重複診断（identity_conflict）のパスを作品の配置から決めるようにした。フォルダー形式ならフォルダー、単一ファイル形式ならメタファイル（<stem>.mimimilli.json）のルート相対パスになる。関連: TASK-471（登録解除時に診断からパスを外す）。

現状: Files はメタファイルを一覧から隠している（server/src/adapters/real/fsBrowse.ts の isMetaFileName）。再採番の UI も、フォルダーの行にしか出ない（client/src/features/files/ui/FilePreviewWorkActions.tsx の entry.isDir の条件）。そのため、単一ファイル形式の作品で ID が重複しても、Files から解消する導線が無い。

TASK-467 以前でも、単一ファイル形式の再採番は動いていなかった（診断のパスがフォルダーで、再採番は join(フォルダー, mimimilli.json) を書き換えていた）。TASK-467 で後退したわけではなく、元から無かった導線を用意するタスクである。

方針（アドバイザー決定）: 重複の対象になっているメタファイルだけを Files に表示し、再採番の UI をファイルの行にも開く。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Filesで、ID重複の対象になっている単一ファイル形式のメタファイルが一覧に表示され、選択できる
- [ ] #2 重複の対象でないメタファイルは、今までどおりFilesに表示されない
- [ ] #3 単一ファイル形式のメタファイルの行から再採番でき、そのメタファイルのidが書き換わって重複が解消する
- [ ] #4 フォルダー形式の重複解消の表示と操作は変わらない
- [ ] #5 fixtureとrealの両方で、単一ファイル形式の重複を解消できることをテストで縛る
- [ ] #6 pnpm check && pnpm test && pnpm test:smoke が通る
<!-- AC:END -->
