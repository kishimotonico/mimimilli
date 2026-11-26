---
id: TASK-529.1
title: Ark UI を導入し、共通層とボタン起点のメニューを置き換えて見た目をそろえる
status: To Do
assignee: []
created_date: '2026-11-26 03:15'
updated_date: '2026-11-26 03:42'
labels:
  - ui
dependencies: []
parent_task_id: TASK-529
priority: high
ordinal: 649000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
@ark-ui/react を導入し、薄い共通層（メニュー部品、退出アニメーションの間 Ark の寿命を延ばすフック、見た目のクラス）を作る。shared/ui/Menu.tsx の PopupMenu と、role="menu" を手書きした6箇所（WorkMetadataActions、FilesAddressBarMenu、SidebarAddMenu、LibrarySortMenu、PlaybackRatePicker、WorkPlayButton）を Ark のメニューへ置き換える。
見た目の推奨案: パネル角 6px（--r-2）、枠 --line-soft、影 --shadow-pop、内側余白 4px、項目の高さ 28px、項目角 4px、文字 --fs-body。選択中は左のチェックの列（14px）に --acc 色のチェック（背景と太字は使わない。チェックやラジオを含むメニューだけ列を確保）。項目にアイコンは付けない。右端に件数（--ink-3、等幅 11px）、ショートカットは出さない。危険な項目は常に --state-danger で区切り線の下。区切り線 --line-soft、小見出し 10px・600・字間 .08em・--ink-2。幅は内容幅・最小 180px（再生速度だけ 112px）、長いラベルは省略記号。ハイライトはホバーもキーボードも --paper-2、無効は --ink-4。アンカーとの間 6px。出入りは不透明度と scale .96→1 を 0.12s。
ADR-0043 の帰結のうち、フォーカスの戻し先と backdrop のガードはこのタスクで決める。参考の試作: .worktrees/task-525-ark-ui/client/src/proto/（捨てる前提）。
関連: ADR-0043、TASK-525、doc-10。見た目の推奨案モック: https://claude.ai/artifact/RQNfTz8bxxPgvJgzChA5di 。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 @ark-ui/react が入り、共通層（メニュー部品・寿命を延ばすフック・見た目のクラス）がある。各所は Ark の部品を直接組み、汎用ラッパーは作らない
- [ ] #2 PopupMenu と手書きの role="menu" 6箇所が Ark のメニューになり、矢印移動と先頭文字移動が使える
- [ ] #3 見た目がモックの推奨案どおりである（スクリーンショットで確かめる）
- [ ] #4 退出アニメーションが付き、退出中は inert で中身が変わらない
- [ ] #5 閉じた後のフォーカスの戻し先（Esc・項目実行・外側クリック）が意図どおりで BODY を経由しない。繰り返し測る。プログラムの focus() でメニューを閉じてしまう箇所と、フォーカスできない領域のクリック後の戻りも確かめる
- [ ] #6 Esc で内側の層から一段ずつ閉じる（ネイティブ dialog の中のメニューを含む）。IME 変換中の Esc・Enter で閉じも実行もしない
- [ ] #7 ネイティブ dialog の中のメニューを開いたまま backdrop をクリックすると、メニューだけが閉じる（ガードの形はこのタスクで決める）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
導入する @ark-ui/react のバージョンは、公開から7日以上経ったものを選ぶ（min-release-age の設定は変えない）。試作は 5.40.1 で確かめたので、それより古い版を選ぶ場合は、試作で確かめた挙動（Esc の層、present、ContextTrigger）が同じか確かめる。

引き継ぎ資料（TASK-529 を着手するエージェント向け。会話の文脈なしで読めるように書いてある）

参照先
- 決定: docs/adr/0043-ui-primitives-ark-ui.md（承認）。比較: backlog doc-10。右クリック要件: doc-8。評価: doc-9
- 見た目のモック（ユーザーがだいたい良いと判断した推奨案）: https://claude.ai/artifact/RQNfTz8bxxPgvJgzChA5di
- 試作のコード（参考、本番に入れない）: ブランチ proto/task-525-ark-ui（最新 e10318e99d5dd969dadc3d6dddb4edc27b8f5142。1bb4c61e〜e10318e9 系）の client/src/proto/。MotionMenuPopup.tsx（present 方式と退出中の inert）、ProtoArkPopover.tsx、ProtoArkComboDialog.tsx、ProtoDialogEscCases.tsx、ProtoArkAxis.tsx（軸A→B切替）、menuBackdropGuard.ts。このブランチは TASK-529 の完了まで残す

試作で分かった注意
- Ark は Esc を document の capture 段で処理する。自作の Esc 処理（React の onKeyDown）を Ark の層の中に置くと、Esc 1回で両方閉じる。自作側で defaultPrevented を見る必要がある
- Ark の Menu 項目は vitest で fireEvent.click では実行されず、userEvent.click が要る
- present 方式では、退出中も data-state="open" のまま。スタイルやテストの条件に data-state を使わない
- ネイティブ dialog の中のメニューは、Portal の container を dialog にする。backdrop の二重クローズ（メニューが pointerdown で閉じた後に dialog の click 判定が走る）にはガードが要る。試作の menuBackdropGuard.ts は、瞬間クリックでは効かなかった

現状のメニュー・ポップアップの調査（調査時点のコード読み）
### 現状のメニュー（client/src 起点、コード読み）

共通トークン: --r-1=4px、--r-2=6px、--shadow-pop、--fs-body=12px、--line、--line-soft。

| 場所 | 起動 | 配置・幅 | 中身 | パネル | ハイライト・選択 | 区切り |
|---|---|---|---|---|---|---|
| PopupMenu（shared/ui/Menu.tsx:84、SplitButton と scan の RowMenu） | クリック | 所属 dialog 内へ portal、above/belowEnd、min-w180 | 文字のみ、右端 trailing（mono 11px ink-2）、danger は --state-danger | p-1、角8、枠 --line、項目 px-2.5 py-1.5 角5、z-10 | hover:paper-2 のみ | なし |
| WorkMetadataActions（preview/WorkMetadataActions.tsx:97） | ⋯ | 非portal、below、w240 | アイコン13＋ラベル、外部URL、登録解除は --r-coral | p-1、角6、line-soft、min-h-7 px-2 角4 | hover/focus:paper-2＋ink-0 | hr |
| FilesAddressBarMenu（files/ui/FilesAddressBarMenu.tsx:63） | ⋯ | 非portal、below、w200 | アイコン13＋1項目 | 同上 | 同上 | なし |
| SidebarAddMenu（library/ui/SidebarAddMenu.tsx:28、styles/shell/sidebar.css:180） | ヘッダー | 見出し下に全幅、z-12 | アイコン13、小見出し（10px 600 字間.08em ink-2）、空表示 | p4、角8、--line、高さ28 px8 角5 | hover:paper-2 | hr |
| LibrarySortMenu（library/ui/LibrarySortMenu.tsx:136、styles/shell/sort-menu.css） | アイコン | 非portal、top+6、right0、min-w188、z-30 | 左チェック14＋ラジオ＋末尾に通常項目 | p4、角6、line-soft、px8 py6 角4 | 選択中 acc-soft 背景＋acc-ink＋600、hover:paper-2 | なし |
| PlaybackRatePicker（player/ui/PlaybackRatePicker.tsx:91） | 速度ピル | body へ portal、above、min-w112、z-50 | ink-0 塗りの箱＋mono 11px 600 ラベル、ラジオ | p4、角6、line-soft、px8 py6 角4 | hover:paper-2、選択中は文字 ink-0 | なし |
| WorkPlayButton ▾（preview/WorkPlayButton.tsx:121） | ▾ | 非portal、top+6、left0、min-w160 | アイコン12＋1項目 | p4、角6、line-soft、px8 py6 角4 | hover/focus-visible:paper-2＋ink-0 | なし |

ばらつき: 枠色2系統、パネル角 8/6・項目角 5/4、項目高さ3系統、選択中の表現3種、危険の赤2トークン、アイコン 13/12/無し、ショートカット表示とサブメニュー矢印は未実装、幅 112〜240 の6種、gap 5/6/7。

振る舞い: 矢印キー移動は Sort と Play だけ（速度は初期フォーカスのみ、他は無し）。閉じ方は useAnchoredPopover 系と usePopoverDismissal 系。退出アニメーションはメニュー7つとも無し（速度だけ CSS keyframes 0.12s）。popoverScale（0.18s、scale.92→1）は GroupValuePopoverPanel・GroupByPickerStage・Lightbox だけ。onContextMenu は0件。

ポップオーバー系: GroupValuePopover（.mll-qoverlay 幅280 max-h360 角6 line-soft z30、popoverScale）、FilterChipAddButton（2段、popoverScale）、WorkEditTagsField/WorkTagEditor（幅260 角6 影のみ枠なし、アニメなし）、RegisterFieldsPopover（role=dialog 幅220 角8 line-soft p-3）、BarVolumePopover。

### design-system.md との差

- メニューのパネルスタイル（角・枠・影・項目高さ・ホバー色）の規定が無い
- z-index 表に PopupMenu・Metadata・Files・Play（10）、SidebarAddMenu（12）が無い
- Motion の「出入りは AnimatePresence」に対し、メニュー6つはアニメ無し、速度は CSS keyframes
- 「見送ったUI案」にメニュー・ポップアップ固有の却下は無い

### 過去の決定

- メニューの見た目を却下した記録は backlog・git に見つからない
- TASK-237（f5f5a263）でソートメニューの開閉アニメを入れたはずが現行は無い（経緯未確認）
- TASK-513.7: 除外は行の︙と主ボタン▾へ、ツールバーにボタンを置かない
- TASK-517.11: 画面の語は「ソート」
- doc-8: 作品メニューの項目と背景メニューの項目、件数は右端、サブメニュー対応必須（何をサブメニューにするかは未定）
- メモリ: 文言は短く説明文なし、内部の語を出さない、合意モックは忠実に再現
<!-- SECTION:NOTES:END -->
