---
id: TASK-447.24
title: 文字入力を shared/ui/TextInput に共通化する
status: Done
assignee: []
created_date: '2026-09-11 08:18'
updated_date: '2026-09-11 09:03'
labels:
  - refactor
  - ui
  - triage
dependencies:
  - TASK-447.22
parent_task_id: TASK-447
priority: high
ordinal: 492000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
負債横断調査の反映 第4回（tmp/uiux-triage-2026-09-11/followup-4.md の1）。inputClass 系の文字列が RegisterWorkDialog・WorkEditDialog・DlsiteEditor・SmartFolderEditorModal・TagCombobox の5箇所に個別定義され、フォント・背景・disabled 対応が揺れている。shared/ui/TextInput.tsx（input の薄いラッパー、font と surface だけ props、他の属性は透過、forwardRef）に集約し、フォーカス表現もそこで1回だけ定義する。TASK-447.22 の取り込み後に着手する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 shared/ui/TextInput.tsx があり、5箇所の文字入力（number 入力を含む）がこれを使い、inputClass 系の定数が残っていない
- [x] #2 フォーカス時の境界線色の変化が TextInput の中で1回だけ定義され、design-system.md の「focus-visible:border-line-strong を併記する」規則が「文字入力は TextInput を使う」に置き換わっている。base.css の文字入力向け規則は TextInput に集約できた範囲で消えている
- [x] #3 意図のある見た目の差（DlsiteEditor の mono 等）は props で残り、それ以外は揃っている。見た目が変わる箇所の before/after スクショが shots-intake にある
- [x] #4 挙動は変わらず、既存テストの期待値を変えていない（変更したテストはタスクメモに列挙）。pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装完了。shared/ui/TextInput.tsx（font: sans|jp|mono, surface: 0|1）を作成し、以下に適用:
RegisterWorkDialog(2)・WorkEditDialog(3)・DlsiteEditor(1)・SmartFolderEditorModal(1)・SmartFolderRuleCard(duration入力3=1コンポーネント)・TagCombobox(1)・TagPrefixRow(1)・TagPrefixAddForm(2)。inputClass系定数は全ファイルから削除（select用に残った箇所はselectClass/COMPACT_INPUT_CLASSへ改名し、TextInputへの委譲であることを明確化）。

SmartFolderRuleCardの`<select>`2箇所（並び替え条件AND/OR、フィールド選択）はTextInputの対象外（<input>ラッパーのため）、selectClassとしてそのまま維持。

見た目の差の統一: SmartFolderRuleCardのDurationInput（時間/分/秒の3つのnumber入力）はfont-monoのみでtext-body(12px)のままだったが、他のmono系入力（RJコード欄等）はfont-mono+text-mono(11px)を対で使っており不揃いだったため、text-mono(11px)に統一。before/afterはshots-intake/447.24-smartfolder-duration-{before,after}.jpg。他の統合箇所（RegisterWorkDialog/WorkEditDialog/DlsiteEditor/SmartFolderEditorModal/TagCombobox）は元のクラス文字列と1:1で対応させたため見た目の変化なし。TagPrefixRow/TagPrefixAddFormは高さ(24px/30px)・border色(line/line-soft)・文字色(ink-1)をclassName上書きで温存し、見た目の変化なし。

副産物のバグ修正: shared/lib/cn.ts のtailwind-merge設定が、tokens.cssの文字サイズトークン（text-body/text-secondary/text-label/text-caption/text-mono）を "font-size" グループとして未登録だったため、text-ink-*等の色クラスと衝突してどちらかが消える不具合があった（TagPrefixAddFormへの適用中に発覚。className={"...text-secondary text-ink-1"}のtext-secondaryが消えてtext-bodyにフォールバックしていた）。classGroupsに"font-size": [text-body, text-secondary, text-label, text-caption, text-mono] を追加して解消。既存テストに影響なし（該当クラスをtoHaveClass等で検査するテストは無し）。

フォーカス表現: TextInput内でoutline-none + focus-visible:border-line-strongを1回だけ定義。design-system.mdの「focus-visible:border-line-strongを併記する」規則を「文字入力はTextInputを使う」に置き換え。base.cssのlayer(base)規則は、TextInputを使わない文字入力（border-acc系のアクティブ編集欄=SettingsModalのフォルダー欄・ScanResultWorksTable/UnregisteredTabのインライン編集、枠線をラッパー側に持つコンテナ型検索欄=SetupScreen・TopBar・AxisValueList・AxisValueQuickList）がoutline:noneの土台として引き続き必要なため削除せず、コメントをTextInput前提に書き換えた。

対象外と判断した入力（理由）:
- SettingsModal のルートフォルダー入力: border-accで能動編集中を示す別系統（focus-visible:border-line-strong系ではない）
- ScanResultWorksTable/UnregisteredTabのインライン編集: 同上（border-acc系）
- SetupScreen/TopBar/AxisValueList/AxisValueQuickList: 枠線・フォーカス表現がラッパーdiv側（focus-within）にあり、input自体はborder-none。TextInputの形（input自身が枠線を持つ）に合わない

実機確認（fixture, 1440x900）: getComputedStyleでborderColor（--line→--line-strong）・outlineStyle=noneをRegisterWorkDialog RJコード欄・WorkEditDialogタイトル/URL欄/DlsiteEditor RJ欄・SmartFolderEditorModal名前欄・TagCombobox・TagPrefixRow編集欄・TagPrefixAddFormの各欄で確認。Tabでボタンへ移るとアクセントのoutline(2px solid)が出ることも確認。

check/test/smoke: pnpm check 通過、pnpm test（server 796 pass, client 1098 pass）、pnpm test:smoke（25 pass）。既存テストの期待値変更なし。

【レビュー対応: cn.ts classGroups "font-size" にtext-control/text-badgeが欠けていた件】
tokens.css（styles/tailwind.css の@theme inline）の--text-*定義は7種（body/secondary/caption/control/label/mono/badge）。当初のcn.ts修正は5種（control/badgeが漏れ）だったため、text-controlを使うButton既定サイズ(sm)・ScanSidebarのタブと、text-badgeを使う通知バッジ等が引き続き影響を受けていた。

## 直し方
1. cn.tsに`FONT_SIZE_TOKENS`（7トークン）を定義してexportし、classGroups["font-size"]はこれをspreadするだけにして一覧を1箇所に集約。
2. client/tests/unit/cn.test.ts に3テスト追加:
   - FONT_SIZE_TOKENSがstyles/tailwind.cssの`--text-<name>:`定義（line-height行を除く）と集合一致することを、実際にCSSファイルを読んで検証（ズレたら即失敗する構造）
   - 7トークンそれぞれをtext-ink-1/text-paper-1/text-accと組み合わせて両方残ることを確認
   - 同じグループ同士（text-body vs text-mono、text-control vs text-label）は後勝ちになることを確認
   CSS動的読み込み方式にした理由: ビルド時生成にすると型の複雑さ・ビルド設定変更のコストが見合わず、既存のtests/unit/textSelection.test.tsで同種のCSS直読みパターンが前例としてあったため踏襲。

## 影響箇所の洗い出し（rgでcn()呼び出し内にfont-sizeトークン+他のtext-*が同居する箇所を全数確認）
見た目が変わる（12px固定だった見た目が本来のトークン値に戻る）:
- client/src/shared/ui/Button.tsx:59 buttonClass — SIZE_CLASS.sm の text-control(11px)。既定sizeのため呼び出し箇所全部（アプリ全体のBtton sm）が対象。md/lgはtext-body(12px=継承既定と同値なので視覚差なし)
- client/src/features/scan/ui/scanModal/ScanSidebar.tsx:98-101 タブボタン — text-control(11px)
- client/src/features/scan/ui/scanModal/ScanSidebar.tsx:108-114 件数バッジ — text-caption(10px)
- client/src/features/scan/ui/scanModal/ScanResultWorksTable.tsx:133 RJコード欄 — text-mono(11px)（今回のfixtureでは0件のタブのため実機未確認、コード上同一パターンのUnregisteredTabで確認済み）
- client/src/features/scan/ui/scanModal/ScanResultWorksTable.tsx:138 DLsite連携状態ラベル — text-secondary(11px)（同上、未確認）
- client/src/features/scan/ui/scanModal/UnregisteredTab.tsx:307 RJコード編集input — text-mono(11px)
- client/src/features/scan/ui/scanModal/UnregisteredTab.tsx:318 RJコード表示ボタン — text-mono(11px)
- client/src/features/player/ui/NowPlayingTrackList.tsx:41 トラック番号 — text-mono(11px)
- client/src/features/player/ui/ABRepeatBar.tsx:27,39 A/Bボタン — text-mono(11px)
- client/src/entities/work/ui/Tag.tsx TAG_BASE — text-secondary(11px)。アプリ全体のタグチップ全部が対象（ブラスト半径が最大）

見た目が変わらない（元々12px=継承既定と同値だったため）:
- ScanResultWorksTable.tsx:101 タイトル編集input — text-body(12px)
- TagCombobox.tsx:300 候補ドロップダウンの選択肢 — text-body(12px)

## 実機確認（fixture, agent-browser session 447.24）
cn.tsを一時的に旧5トークン版に戻してbefore、7トークン版でafterを比較。
- ScanSidebar: タブ12px→11px、バッジ12px→11px、Button sm(「2件をライブラリに追加」)12px→11px。スクショ shots-intake/447.24-cn-scansidebar-{before,after}.jpg（拡大するとタブ文字・バッジ・ボタン文字が僅かに縮小しているのが分かる）
- UnregisteredTab「未検出」ボタン: 11px確認
- Tag（作品詳細のタグチップ）: 11px確認（cls確認、text-secondary text-ink-1が両方残っている）
- TagCombobox候補: 12px（変化なし、想定通り）
- ABRepeatBar A/Bボタン、NowPlayingTrackListのトラック番号: いずれも11px確認。スクショ shots-intake/447.24-cn-nowplaying-after.jpg
- ScanResultWorksTableはfixture new-workシナリオでは対象タブが0件のため実機確認できず。UnregisteredTabと完全に同一のcn()パターン（font-mono text-mono + 条件色）であることをコードで確認済み

## テスト
pnpm check 通過、pnpm test（server 796 pass / client 1101 pass、cn.test.ts 7件中3件が今回の追加）、pnpm test:smoke 25 pass。

【アドバイザー補足対応】(a)(b)(d)は前回の対応で既に満たしている（classGroups "font-size"への登録のみでcn()側に分岐を足していない、FONT_SIZE_TOKENSをtailwind.cssの--text-*から抽出したテストで一致検証、全7トークン×色クラスの組み合わせテスト、cn.ts修正は独立コミット238ab2f）。今回はコード変更なし、(c)の追加検証のみ。

## 優先4画面の実機確認（fixture, before=cn.ts一時的に旧5トークン版, after=現行7トークン版）
- 設定モーダル（候補から外したフォルダー→「戻す」ボタン、Button既定size=sm=text-control）: 12px→11px（可視差あり）。スクショ shots-intake/447.24-cn-settings-{before,after}.jpg
- スキャンの要対応タブ（NeedsAttentionTabの「Filesで開く」ボタン、Button sm=text-control）: 11px→11px（可視差なし）。理由: 祖先の<table>要素にtext-secondary(11px)が直接付いており、ボタン自身のtext-controlクラスが消えていてもtext-secondaryを継承して偶然同じ11pxになっていた（className自体は「戻る前: text-control欠落／戻った後: text-control付与」で差がある。数値がたまたま同じなだけ）。スクショ shots-intake/447.24-cn-needsattention-{before,after}.jpg
- トラック一覧（NowPlayingTrackListのトラック番号、text-mono）: 今回のcontrol/badge漏れの対象外（text-monoは前回修正で既に直っていた）。11px・text-acc/text-ink-2とも保持を確認。スクショ shots-intake/447.24-cn-tracklist-after.jpg
- タグ追加（TagComboboxの候補、text-body）: 同じく対象外（text-bodyは前回修正で直っていた）。12px（継承既定と同値のため変化なし）。スクショ shots-intake/447.24-cn-tagcombobox-after.jpg

## 影響箇所の一覧表（design-system.mdのトークン用途との整合列つき）

| 箇所 | トークン | 用途（docs記載） | 実際の内容 | 整合性 |
|---|---|---|---|---|
| Button.tsx:59 buttonClass sm | text-control(11px) | ボタン・操作ラベル | ボタン全般 | 一致 |
| ExcludedFoldersSettings.tsx:76 「戻す」 | text-control | 同上 | ボタン | 一致 |
| NeedsAttentionTab内Button（要対応タブの操作列） | text-control | 同上 | ボタン | 一致 |
| ScanSidebar.tsx:98-101 タブボタン | text-control | 同上 | role=tabのラベル | 一致（ボタン相当） |
| ScanSidebar.tsx:108-114 件数バッジ | text-caption(10px) | キャプション・空状態・補足ヒント | rounded-pill内の件数の数字（font-mono併用） | **不一致の疑い**: 構造がTopBar.tsx:216／NotificationBell.tsx:100の通知バッジ（同じrounded-pill+数字+font-mono構成）と同一だが、そちらはtext-badge(9px)を使っている。docsのtext-badge説明「通知バッジ等、丸ピル内の極小数字」はこちらの用途そのものに見える。text-caption「キャプション・空状態・補足ヒント」との対応は薄い |
| ScanResultWorksTable.tsx:133 RJコード欄 | text-mono | 時刻・件数・パス等の数値/等幅表示 | RJコード | 一致 |
| ScanResultWorksTable.tsx:138 DLsite連携状態ラベル | text-secondary | セカンダリ情報 | ステータス文言 | 一致 |
| UnregisteredTab.tsx:307/318 RJコード欄 | text-mono | 同上 | RJコード | 一致 |
| NowPlayingTrackList.tsx:41 トラック番号 | text-mono | 同上 | 番号 | 一致 |
| ABRepeatBar.tsx:27/39 A/Bボタン | text-mono | 同上（font-mono併用） | ボタン内の1文字ラベル「A」「B」 | **要確認**: 機能はボタン（docsの「ボタン・操作ラベル」＝text-controlの説明文と字面は一致）だが、実装はtext-mono+font-mono+font-boldで「コード的記号」として意図的にスタイリングしている可能性がある。RJコード等と同系の「等幅の記号表示」という解釈も成り立つため、ScanSidebarの件ほど確信度は高くない |
| Tag.tsx TAG_BASE（タグチップ全般） | text-secondary | タグ値・補助テキスト | タグ値そのもの | 一致（docsの文言と完全一致） |
| ScanResultWorksTable.tsx:101 タイトル編集input | text-body | 主要本文 | タイトル | 一致（可視差なし、12px=継承既定と同値） |
| TagCombobox.tsx:300 候補ドロップダウン | text-body | 主要本文 | タグ候補文字列 | 一致（可視差なし） |

## 報告（自分では直していません）
ScanSidebar.tsx:108-114の件数バッジは、同一構造のTopBar/NotificationBellの通知バッジがtext-badgeを使っているのに対しtext-caption を使っており、割り当てが誤りの可能性が高いです。ABRepeatBarのA/BボタンラベルがtIext-mono（本来text-controlが妥当か）は判断が分かれるため参考情報として添えました。直すかどうかは統括判断でお願いします。

【アドバイザー追加補足2点への対応】

## (1) cn.test.tsの正規表現修正（独立コミット74da7bf）
/--text-([a-z]+):/g → /--text-([a-z][a-z0-9-]*):/g に変更し、ハイフン入りトークン名（例: text-badge-lg）も拾えるようにした。付随する--text-<name>--line-height定義は、捕捉した名前に二重ハイフン(--)が含まれるものとして除外する（line-height系は常に--line-height接尾辞のため単一ハイフンのトークン名と区別できる）。node -eで--text-body/--text-body--line-height/--text-badge-lg/--text-badge-lg--line-heightの4パターンを与えて[body, badge-lg]だけ抽出されることを確認済み。cn.test.ts 7件（新規追加3件含む）全通過。

## (2) 影響箇所の一覧表（design-system.mdのトークン用途との整合列つき、確定版）

| 箇所 | トークン(px) | docsの用途 | 実際の内容 | 整合性 |
|---|---|---|---|---|
| Button.tsx:59 buttonClass size=sm（既定） | text-control(11) | ボタン・操作ラベル | ボタン全般（アプリ全体） | 一致 |
| ExcludedFoldersSettings.tsx:76「戻す」 | text-control(11) | 同上 | ボタン | 一致 |
| NeedsAttentionTab（要対応タブ操作列のButton） | text-control(11) | 同上 | ボタン | 一致 |
| ScanSidebar.tsx:98-101 タブボタン | text-control(11) | 同上 | role=tabラベル | 一致（ボタン相当） |
| ScanSidebar.tsx:108-114 件数バッジ | text-caption(10) | キャプション・空状態・補足ヒント | rounded-pill内の件数数字（font-mono併用） | **不一致の疑い（確信度高）**: 同一構造（rounded-pill+数字+font-mono）のTopBar.tsx:216／NotificationBell.tsx:100の通知バッジはtext-badge(9)を使用。docsのtext-badge説明「通知バッジ等、丸ピル内の極小数字」がこちらの用途そのもの |
| ScanResultWorksTable.tsx:133 RJコード欄 | text-mono(11) | 時刻・件数・パス等の数値/等幅表示 | RJコード | 一致 |
| ScanResultWorksTable.tsx:138 DLsite連携状態ラベル | text-secondary(11) | セカンダリ情報 | ステータス文言 | 一致 |
| UnregisteredTab.tsx:307/318 RJコード欄 | text-mono(11) | 同上 | RJコード | 一致 |
| NowPlayingTrackList.tsx:41 トラック番号 | text-mono(11) | 同上 | 番号 | 一致 |
| ABRepeatBar.tsx:27/39 A/Bボタン | text-mono(11) | 同上（font-mono併用） | ボタン内の1文字ラベル | **要確認（確信度中）**: 機能はボタン（text-controlの説明と字面一致）だが、実装はtext-mono+font-mono+font-boldでRJコード等と同系の「等幅の記号表示」として意図的にスタイリングした可能性もある |
| Tag.tsx TAG_BASE（タグチップ全般、アプリ全体） | text-secondary(11) | タグ値・補助テキスト | タグ値そのもの | 一致（docs文言と完全一致） |
| ScanResultWorksTable.tsx:101 タイトル編集input | text-body(12) | 主要本文 | タイトル | 一致 |
| TagCombobox.tsx:300 候補ドロップダウン | text-body(12) | 主要本文 | タグ候補文字列 | 一致 |

不一致の疑いがある2件（ScanSidebar件数バッジ、ABRepeatBar A/Bボタン）は自分では修正していません。直すかは統括判断でお願いします。

## before/afterスクショ（今回追加分、fixture 1440x900）
- 設定モーダル フッター/候補から外したフォルダー（Button sm「戻す」）: shots-intake/447.24-cn-settings-{before,after}.jpg（12px→11px、可視差あり）
- 設定モーダル タグprefix一覧＋DLsite一括取得/適用ボタン: shots-intake/447.24-cn-settings-prefixlist-{before,after}.jpg（表示されているボタンは全てsize="md"=text-body(12px)で今回の修正対象外のため可視差なし。実測12px→12pxで確認）
- スキャンの要対応タブ（NeedsAttentionTab「Filesで開く」）: shots-intake/447.24-cn-needsattention-{before,after}.jpg（祖先<table>のtext-secondary(11px)継承により偶然どちらも11px。classNameのtext-control有無は変わっている）
- トラック一覧（NowPlayingTrackListのトラック番号）: shots-intake/447.24-cn-tracklist-{before,after}.jpg（beforeは今回のcontrol/badge漏れ検証ではなく、cn.ts修正前の完全に壊れた状態＝font-sizeグループ未登録の状態と比較。12px→11px、可視差あり。text-monoは前回の初回修正で既に直っていたため、5トークン版との比較では差が出ない）
- タグ追加＋タグチップ（TagCombobox候補／Tag.tsxチップ）: shots-intake/447.24-cn-tagcombobox-{before,after}.jpg、shots-intake/447.24-cn-tagchip-{before,after}.jpg（同上、cn.ts完全未修正状態と比較。候補ドロップダウンはtext-body=12px=継承既定と同値のため可視差なし、タグチップはtext-secondary=11pxで12px→11pxの可視差あり）

撮影は全てcn.tsを一時的に該当バージョンへ戻して撮影後、都度元に戻してgit diffが空であることを確認しています。

## テスト
pnpm --filter client exec vitest run tests/unit/cn.test.ts 通過（7件）。cn.test.ts以外はコード変更なしのため、フルのpnpm check/test/smokeは前回報告時点の結果（全通過）から変わりません。

統括判断（トークン用途の不一致の疑い2件）: ScanSidebar の件数バッジ（text-caption、10px）と ABRepeatBar の A/B ボタン（text-mono、11px）は、いずれも master の px 値と同値で見た目が master と一致しているため変更しない。

【統括判断】用途の不一致疑い2件は「変更なし（masterと同値）」。
- ScanSidebar.tsx:108-114の件数バッジ: masterでもtext-caption(10px)。見た目はmasterと一致するため変更なし
- ABRepeatBar.tsx:27/39のA/Bボタン: masterでもtext-mono(11px)の等幅表示。見た目はmasterと一致するため変更なし
判断: 変更なし（masterと同値）
<!-- SECTION:NOTES:END -->
