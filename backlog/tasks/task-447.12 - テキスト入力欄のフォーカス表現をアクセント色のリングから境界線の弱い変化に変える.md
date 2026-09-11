---
id: TASK-447.12
title: テキスト入力欄のフォーカス表現をアクセント色のリングから境界線の弱い変化に変える
status: Done
assignee: []
created_date: '2026-09-11 04:27'
updated_date: '2026-09-11 05:01'
labels:
  - ui
  - ux
  - triage
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 480000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
実機確認フィードバック第1回（tmp/uiux-triage-2026-09-11/followup-1.md の2）。分類軸のクイックオーバーレイの検索欄（AxisValueQuickList.tsx、開いた瞬間に autoFocus）に --focus-ring（2px solid var(--acc)）が当たり、オレンジで目立ちすぎる。テキスト入力はキャレットで位置が分かるので、アクセント色のリングは出さない。ボタン・行・チップ等の focus-visible リングは維持する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 テキスト入力欄（input[type=text]/search 等の文字入力、textarea）はフォーカス時にアクセント色のリングを出さず、境界線色の弱い変化（例: --line → --ink-3 相当）だけで示す
- [x] #2 対象はクイックオーバーレイの検索欄に加え、トップバー検索・設定モーダル・スマートフォルダー条件・タグ追加コンボボックス・作品編集などアプリ内のテキスト入力すべてで、変更箇所の一覧がタスクメモにある
- [x] #3 ボタン・行・チップなどキーボード移動で位置を示す要素の focus-visible リングは変わっていない
- [x] #4 docs/design-system.md のフォーカスリングの記述がこの方針に合わせて更新されている
- [x] #5 着手前後のスクリーンショットを tmp/uiux-triage-2026-09-11/shots-intake/447.12-before.jpg と -after.jpg（クイックオーバーレイ検索欄）ほか必要に応じて連番で置いている
- [x] #6 変更範囲のテストが通り、既存テストの期待値を辻褄合わせで削除・緩和していない（仕様変更で消した・書き換えたテストはタスクメモに列挙）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
変更箇所一覧:
- client/src/styles/shell/base.css: グローバルfocus-visible規則を分離。button/a/select/[tabindex]・チェックボックス/ラジオ/レンジ/ファイル/カラーは従来通り2px solid var(--acc)のリング。それ以外のinput（実質テキスト系）とtextareaはoutline:none + border-color: var(--line-strong)に変更
- client/src/styles/shell/library-a.css: .mll-bar__search（トップバー検索）に border: 1px solid transparent を追加し、:focus-within の box-shadow(var(--acc-line))をborder-color: var(--line-strong)に置き換え
- client/src/styles/shell/library-d.css: .mll-qlist__search（クイックオーバーレイ検索欄）・.mll-vsearch（値一覧の検索欄）に :focus-within { border-bottom-color: var(--line-strong) } を追加
- client/src/shared/ui/TagCombobox.tsx: input の focus:border-acc を削除（タグ追加コンボボックス）
- client/src/features/files/ui/RegisterWorkDialog.tsx: inputClass（RJコード欄・作品名欄）の focus:border-acc を削除
- client/src/features/library/ui/SmartFolderEditorModal.tsx: inputClass（スマートフォルダー条件エディタの各入力）の focus:border-acc を削除
- client/src/features/library/ui/preview/DlsiteEditor.tsx: inputClass（RJ/VJコード欄）の focus:border-acc を削除
- client/src/features/library/ui/preview/WorkEditDialog.tsx: inputClass（タイトル・URLラベル・URL欄）とタイトル入力の個別classNameの focus:border-acc を削除
- client/src/features/setup/ui/SetupScreen.tsx: パス入力欄（input自体はborder-none）のラッパーdivに focus-within:border-line-strong を追加（グローバル規則が効かないボーダーレス構成のため個別対応）
対象外で変更していない（常時アクセント枠が意図された表示のため）: SettingsModal.tsx のフォルダーパス欄（border-acc固定）、UnregisteredTab.tsx/ScanResultWorksTable.tsx の行内編集入力（編集中はborder-acc固定、focus専用ではない）
docs/design-system.md の「フォーカス表示」節をテキスト入力とそれ以外で挙動が分かれる旨に更新。
スクリーンショット: 447.12-before.jpg/-after.jpg（クイックオーバーレイ検索欄）、-before-2/-after-2（トップバー検索）、-after-3（スキャンボタンにフォーカスしアクセントリング維持を確認）。border-color の変化は1px程度で目視では分かりにくいため、getComputedStyle実測でも focus-visible=true・outline:none・border-color: oklch(0.78 0.01 85)（=--line-strong）を確認済み。

レビュー指摘（高）を修正: base.cssの:focus-visible規則はlayer(base)にあり、Tailwind utilitiesレイヤーの静的なborder-line/border-line-soft等に必ず負ける（カスケードレイヤーは詳細度より先に評価）ため、focus:border-acc撤去箇所（TagCombobox、RegisterWorkDialog、SmartFolderEditorModal、DlsiteEditor、WorkEditDialog×2）とTagPrefixSettingsのINPUT_CLASS・editingLabel入力の計6箇所+2箇所で、フォーカスしても境界線変化が起きない状態になっていた。
修正方針: レビュー提案の(2)を採用。utilities層で確実に勝つよう、各inputへ`focus-visible:border-line-strong`ユーティリティを個別に戻した（focus:border-accの単純な置き換え。base.cssのoutline:none側はレイヤーに関係なく競合するutilityが無いため元のままで問題なし）。base.css側のグローバル規則は維持（コンテナ型検索欄3件はcomponents CSSで競合utilityが無いため元々問題なし）。

実機確認（getComputedStyle実測、フォーカス時にborder-color: oklch(0.78 0.01 85)=--line-strongへ変化することを確認、既定色との差分も確認済み）:
1. トップバー検索（.mll-bar__search） OK（transparent→line-strong）
2. クイックオーバーレイ検索（.mll-qlist__search、CV軸） OK
3. 値一覧検索（.mll-vsearch、CV値一覧） OK（line-soft→line-strong）
4. WorkEditDialog タイトル欄 OK
5. WorkEditDialog URLラベル欄 OK
6. WorkEditDialog URL欄 OK
7. DlsiteEditor RJ/VJコード欄（WorkEditDialog内） OK
8. TagCombobox（作品詳細のタグ追加） OK
9. SmartFolderEditorModal 名前欄 OK
10. SmartFolderEditorModal 長さ（時間）欄 OK
11. TagPrefixSettings 新しいprefix欄 OK
12. RegisterWorkDialog RJコード欄 OK
13. RegisterWorkDialog 作品名欄 OK

未実機確認（同一クラス構成からの類推）:
- SetupScreen パス入力のラッパーdiv（focus-within:border-line-strongをborder-lineと同じutilitiesレイヤーに追加済み。フィクスチャは常にルート設定済みでセットアップ画面に到達できず未確認。同レイヤー内の通常の詳細度比較で勝つ構成なのでbase.cssの問題とは無関係）
- TagPrefixSettings editingLabelInputRef（既存prefixラベルのインライン編集入力）: 操作導線（編集開始トリガー）をUIから見つけられず未確認。INPUT_CLASS/newLabel欄と全く同じクラス構成のため同様に機能する想定
- SettingsModalのフォルダー欄・UnregisteredTab/ScanResultWorksTableの行内編集入力は今回のフォーカス変更と無関係（常時border-acc固定、対象外のまま）

pnpm check・変更範囲unit・client全体unit（147ファイル1081件）・test:smoke（25件）すべてpass。
<!-- SECTION:NOTES:END -->
