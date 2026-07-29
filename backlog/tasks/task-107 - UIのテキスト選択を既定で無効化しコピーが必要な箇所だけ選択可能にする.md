---
id: TASK-107
title: UIのテキスト選択を既定で無効化しコピーが必要な箇所だけ選択可能にする
status: To Do
assignee: []
created_date: '2026-07-26 14:45'
updated_date: '2026-07-26 15:25'
labels: []
dependencies: []
documentation:
  - docs/design-system.md
ordinal: 111000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 背景

現状 client/ には user-select の指定が1件も無く（`user-select` / `select-none` / `select-text` すべて0件）、UI全体でテキストが選択できる。そのためボタンやツールバーのラベルをドラッグすると意図せず範囲選択が起き、操作の邪魔になっている。

実害として、グリッドのサイズスライダー（`.mll-grid-size`）で不具合が出ている。ラベルの `<span>サイズ</span>` や `<output>176px</output>` が選択可能なため、選択済みテキストの上からドラッグするとHTML5のドラッグ&ドロップが発動し、禁止カーソルになってスライダーを操作できなくなる。ウィンドウリサイズでポインタとスライダーの相対位置がズレたときに起きやすい。

## 方針

アプリのUIシャーシは user-select: none を既定とし、コピーされうるテキストだけ明示的に選択可能へ戻す。個別対応ではなく既定を反転させる仕様変更として行う。

一覧やグリッドの行内テキストは `<button>` の中にあり、選択ドラッグがクリック・ダブルクリック再生と競合するため、選択可能には戻さない。コピー需要は情報ダイアログや詳細表示に寄せる。

## 実装メモ（調査済み）

- 既定: `shell.css` の `@layer base` にある `.mle-app` へ `user-select: none` を追加。`.mle-app *` は不要（継承で足りる）
- 入力要素: 同じ `@layer base` で `.mle-app input, .mle-app textarea, .mle-app select` に `user-select: text`
- 既存クラスがある箇所は `@layer components` で戻す（下表のクラス名参照）
- 専用クラスが無い箇所は Tailwind の `select-text` を使う（design-system.md のとおり utilities は components より強いため局所上書きが安全）
- 初回セットアップ画面（SetupScreen）は `.mle-app` の外側にあるため、別途同じ既定を当てる必要がある
- textarea と contenteditable は現状0件。クリップボードAPI・コピーボタンも未実装なので、コピー手段は選択に依存している

## 選択可能に戻す具体箇所

すべて client/src/ 配下。

| ファイル | 対象テキスト | 手掛かり |
|---|---|---|
| features/library/ui/preview/WorkStatusWarnings.tsx | 物理パス、errorMessage、dlsite.error | `.mle-prv__warn-path` / `.mle-prv__warn-text` |
| features/library/ui/preview/WorkInfoDialog.tsx | 物理パス、RJコード、エラー、適用済みタグ、日時、再生位置、プレイリスト名 | 閲覧専用ダイアログ。本文まとめて可 |
| features/files/ui/FilePreview.tsx | ファイル/フォルダーのフルパス、メタグリッドのパス行 | `.mle-fprev__path` / `.mle-fprev__v` |
| features/library/ui/DlsiteParseFailedModal.tsx | 各行のRJコード、フッターのCLI例文 | `font-mono` の span と p |
| features/settings/ui/SettingsModal.tsx | ルートフォルダーパス（閲覧モード） | inline style 主体のため Tailwind 推奨 |
| features/library/ui/preview/DlsiteEditor.tsx | 適用ダイアログ比較表（カバー画像パス・取得タイトル・タグ名）、APIエラー | DlsiteApplyDialog |
| features/setup/ui/SetupScreen.tsx | scanError | `.mle-app` 外 |

## 選択可能に戻さない箇所（意図的）

WorkRow / WorkGrid / ContentColumn / DrillHeader / FileRow / AxisLanding の行・タイル内テキスト、プレイヤーバーとフルスクリーンプレイヤーの曲名、通知ベルの行ラベル。いずれも `<button>` 内にあり、選択ドラッグが操作と競合するため。

## 対象外

- コピーボタンやクリップボード連携の新規実装（必要なら別タスク）
- 再生エラーの詳細は現状 `title` 属性にしか出ておらず、user-select では解決しない（別判断）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 アプリ内のUIテキスト（ボタンラベル、ツールバー、ナビゲーション、見出し、件数バッジ等）がドラッグしても選択されない
- [ ] #2 input / select では従来どおり入力・テキスト選択・IME変換ができる
- [ ] #3 物理パス・RJコード・エラーメッセージ・CLI例文・ルートフォルダーパス・作品情報ダイアログの内容は選択してコピーできる
- [ ] #4 初回セットアップ画面にも同じ既定が適用される
- [ ] #5 グリッドのサイズスライダーのラベル上からドラッグしても範囲選択や禁止カーソルが発生せず、スライダーを操作できる
- [ ] #6 一覧・グリッド・ファイル一覧のクリックおよびダブルクリック再生が従来どおり動作する
<!-- AC:END -->
