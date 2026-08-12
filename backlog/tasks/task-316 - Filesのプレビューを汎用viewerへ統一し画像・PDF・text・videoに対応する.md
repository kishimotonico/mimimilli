---
id: TASK-316
title: Filesのプレビューを汎用viewerへ統一し画像・PDF・text・videoに対応する
status: To Do
assignee: []
created_date: '2026-08-12 11:31'
labels: []
dependencies:
  - TASK-315
priority: medium
ordinal: 326000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
レビュー「未登録viewerをWorkspace resourceへ統一する」のclient側。FilePreview（client/src/features/files/ui/FilePreview.tsx）をTASK-315のmedia API・shared契約ベースへ置き換え、client独自の拡張子推測を削除する。UI仕様: 画像=プレビュー領域にフィット表示、クリックで既存の全画面拡大（TASK-298のライトボックス）を流用／PDF=ブラウザ内蔵表示（iframe/object）／text=等幅フォントでスクロール表示、server側サイズ上限超過時は先頭部分＋「サイズ上限のため先頭のみ表示」の注記／video=標準video要素（controls付き）／preview不可種別=種別名と拡張子を示した空状態（エラー表示とは区別）。レイアウト・配色はdocs/design-system.mdに従い、既存FilePreviewの構造を踏襲する。未登録音声のresume・履歴は保存しない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 未登録ファイルの画像・PDF・text・videoがFilesのプレビューで表示・再生できる
- [ ] #2 種別判定がsharedのMediaKind/PreviewCapability経由になり、clientの拡張子推測が削除されている
- [ ] #3 preview不可種別が種別名つきの空状態で表示され、読み込みエラーと区別される
- [ ] #4 textのサイズ上限超過時に先頭のみ表示と注記が出る
- [ ] #5 pnpm test:smokeが通り、各種別のプレビュー表示のsmokeがある
<!-- AC:END -->
