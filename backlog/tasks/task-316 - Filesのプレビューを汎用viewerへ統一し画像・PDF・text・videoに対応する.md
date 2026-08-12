---
id: TASK-316
title: Filesのプレビューを汎用viewerへ統一し画像・PDF・text・videoに対応する
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-12 11:31'
updated_date: '2026-08-12 13:14'
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
- [x] #1 未登録ファイルの画像・PDF・text・videoがFilesのプレビューで表示・再生できる
- [x] #2 種別判定がsharedのMediaKind/PreviewCapability経由になり、clientの拡張子推測が削除されている
- [x] #3 preview不可種別が種別名つきの空状態で表示され、読み込みエラーと区別される
- [x] #4 textのサイズ上限超過時に先頭のみ表示と注記が出る
- [ ] #5 pnpm test:smokeが通り、各種別のプレビュー表示のsmokeがある
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Filesの種別分岐をFsEntryのmediaKind/previewへ統一し、Workspace media APIで各viewerを表示する。\n2. 既存の画像ライトボックスとFilesの一時再生を維持し、不可・取得失敗の状態を分ける。\n3. fixtureとsmoke、unitテストを更新する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
FilePreviewをWorkspace media APIへ統一し、mediaKind/previewだけでviewerを選択するように実装した。画像・PDF・text・video・不可表示とtext切り詰めを追加し、Files音声の既存一時キューは維持した。fixture viewerとsmoke、Filesのunit fixtureを更新した。対象unit 23件は成功。client/server typecheckは担当外の並行変更で失敗した（Files変更由来の診断なし）。smoke実行・UI確認は委譲元のため未実施。

再分類: shared checkは成功。client checkの6診断、server checkの6診断はいずれもTASK-316変更外で、各エラー対象ファイルはgit diff e124b75で差分なし、git show e124b75で同じ該当行を確認した。対象Files unit 23件と変更7ファイルのoxfmt --check、git diff --checkは成功。AC #5は委譲元のsmoke実行待ちのため未チェック、StatusはIn Progressのまま。

訂正: client checkの診断数は5件（WorkDetail 2件、WorkEditDialog、WorkMetadataActions、useWorkTagEditor）、server checkは6件。

fixture実体を修正: 画像は有効なSVG、PDFはxref付き最小1ページPDF、動画は有効なWebM assetへ置換した。smokeは画像naturalWidth、PDF responseのPDF header、video readyState/durationを検証する。ChromiumのPDF pluginはobject.contentDocumentを公開しないため、object表示と実レスポンスのheader/bodyを組み合わせて確認する。bun test server/tests/fixtureMedia.test.ts（16件）とFiles unit（23件）、変更範囲のoxfmt --check、git diff --checkは成功。smoke本実行は委譲元待ち。
<!-- SECTION:NOTES:END -->
