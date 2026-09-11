---
id: TASK-447.6
title: Filesプレビューの絶対パス表示を整理し、FilePreviewを責務ごとに分割する
status: Done
assignee: []
created_date: '2026-09-11 00:52'
updated_date: '2026-09-11 02:07'
labels:
  - ui
  - ux
  - triage
dependencies:
  - TASK-447.1
parent_task_id: TASK-447
priority: high
ordinal: 474000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-447 の「直す」判定のうち 428.18 を直す。ユーザー理由「適切なリファクタ・設計にすればOK。絶対パスのコピーはフォルダーのハンバーガーメニュー内に『絶対パスをコピー』を足す程度。テキスト表示は画面情報の重複が多い」。FilePreview.tsx は パネル枠・登録mutation・作品タイトル取得・3種のエラー表示・リサイズドラッグの5責務が同居している（tmp/uiux-triage-2026-09-11/design-review.md (C)）。404・登録済み・再生状態の矛盾解消とプレビュー可変幅は残す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 絶対パスのコピーはフォルダーのメニューの「絶対パスをコピー」1項目で提供され、プレビュー内の絶対パスのテキスト表示と説明文が無い。フォルダーのメニューが無い場合は着手前に配置案を統括へ報告している
- [x] #2 404・登録済み・再生状態の表示とプレビュー可変幅・ドラッグリサイズの挙動が変わっていない
- [x] #3 FilePreview.tsx が責務ごとのモジュールに分割され、TASK-415 のメディア描画と登録ワークフローの境界が保たれている
- [x] #4 UI変更（パスコピー移設・テキスト削除）と分割リファクタが別コミットになっている
- [x] #5 着手前後のスクリーンショット（fixture、1440x900）を tmp/uiux-triage-2026-09-11/shots-intake/447.6-before.jpg と tmp/uiux-triage-2026-09-11/shots-intake/447.6-after.jpg に置き、タスクメモから参照している
- [x] #6 変更範囲のテストが通り、既存テストの期待値を削除・緩和していない（仕様変更で書き換えた期待値はタスクメモに列挙）
<!-- AC:END -->





## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ステップ2 UI変更完了。配置はアドレスバー右端の「…」（AddressBar.tsx:73相当）に統括判断で確定。Files モードのときだけ有効化し、メニュー1項目「絶対パスをコピー」＝現在地（filesRelPathAtom + rootFolder）の絶対パスをコピーする features/files/ui/FilesAddressBarMenu.tsx を新設。FilePreview.tsx のpathblock（パステキスト・コピーボタン・説明文）とrootFolder propを削除、CSS(mle-fprev__pathblock*)も削除。
テスト: AddressBar.test.tsx に「ファイルモードで有効化・絶対パスコピー」のケースを追加。rootFolder propを渡していたFilePreviewResizeDrag/FilePreviewMissingSelectionのtestからprops削除（型エラー解消のみ、期待値変更なし）。

ステップ3 分割リファクタ完了（未コミット、統括のコミット待ち）。
新規: features/files/model/useFilePreviewResize.ts（パネル幅ドラッグリサイズ）、
features/files/model/useSingleFileWorkTitle.ts（単一ファイル作品のタイトル取得）、
features/files/ui/FilePreviewStates.tsx（EmptyPreview/FileLoadErrorPreview/MissingSelectionPreviewの3種のエラー・空表示）、
features/files/ui/FilePreviewWorkActions.tsx（登録・解除・ID重複取り込みのmutation・ダイアログ・アクション行・ID重複セクション）。
FilePreviewMedia.tsx にFilePreviewMediaSlot（WorkspaceMedia/Heroの振り分け）を追加。
FileLoadError型はfeatures/files/model/types.tsへ移動（FilePreview.tsxが再exportし呼び出し側のimportパスは維持）。
FilePreview.tsx はパネル枠(anchor/close/resize handle/hd/body)と各モジュールの合成のみの約195行に縮小（元約540行）。
挙動・テスト期待値は変更なし（rootFolder削除に伴う型合わせ以外、テストの書き換えは無し）。
pnpm check / client unit(147ファイル1088件) / pnpm test:smoke(25件)すべてpass。
<!-- SECTION:NOTES:END -->
