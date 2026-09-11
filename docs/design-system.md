# デザインシステム規約

レイアウト・機能仕様の正は実装（`client/src/`）。本書は実装からは読み取れない設計意図・規約だけを記す。出典の詳細モックは Git 履歴の `docs/design_handoff_mimimilli_library/`（2026-07-03 削除）にある。

## カラートークンの意味づけ

トークン定義の正は `client/src/styles/tokens.css`（oklch）。用途は以下の通り。

- `--paper-0〜4`: 背景・面。0=ページ床、1=カード等の浮いた面、2=hover、3=pressed/行の縞、4=selected
- `--line` / `--line-soft` / `--line-strong`: 罫線。強調度の3段階
- `--ink-0〜4`: 文字色。0=本文、1=セカンダリ、2=キャプション、3=プレースホルダー、4=ごく薄い。`--ink-3`はWCAG AAの4.5:1に届かないため、`::placeholder`と意図的にごく弱い装飾テキスト（空状態の補足・無効化アイコン等）以外の実コンテンツ（見出し・サブタイトル・件数・メタ情報等）には使わない。読ませる文字は最低でも`--ink-2`にする
- `--acc` 系: アクセント（既定は柿色）。soft=淡色背景、line=枠線、ink=アクセント上の文字
- riso 系（`--r-coral` / `-leaf` / `-mustard` / `-plum`）: カバーアートやマルチchミキサーの色分け用。リソグラフ風の彩度
- タグカテゴリ色（`--cv-color` / `--circle-color` / `--series-color` / `--cat-color`）: 構造化タグ（`cv/` `サークル/` `シリーズ/` `カテゴリ/`）を視覚的に区別する専用色。フラットタグには使わない。値の実背景（`--paper-2`、hover時`--paper-3`）の両方で4.5:1以上を満たすよう明度を調整済み。色を変える場合は両背景で計算し直す
- `--shadow-cover`: カバーアート専用の影（内側ハイライト付き）。通常の面には `--shadow-1/2/pop` を使う

## テーマとアクセント

ダークテーマは未実装（`.ml-dark` のトークン先行定義も撤去済み）。将来対応する場合はトークンから設計し直す。アクセント色は `.ml-acc-coral` / `.ml-acc-grass` / `.ml-acc-cobalt` の差し替えクラスだけで全体に伝播する。

モックのみに存在した `.ml-acc-graph` は実装未移植。必要になった場合は Git 履歴の削除前ディレクトリを参照する。

## タイポグラフィ

- OSゴシック（`--font-jp`）: 本文・日本語UIの既定書体。`"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", system-ui, sans-serif`（Windows 11 24H2以降は Noto Sans JP、Mac は Hiragino、Linux 開発環境は Noto Sans CJK JP で描画）
- `Geist`（`--font-sans`）: ブランド表記・操作系コントロールなど非本文
- `JetBrains Mono`（`--font-mono`）: 時刻・件数・メタ情報などの数値表示

### 文字サイズトークン

サイズ・行高は用途別トークンに集約する（`tokens.css` の `--fs-*`/`--lh-*`、Tailwindでは `text-body` 等のユーティリティとして使える）。px直書き（`font-size: Npx` / `text-[Npx]`）は禁止で、この7段のいずれかへ丸める。フォントファミリー（`--font-jp`/`--font-sans`/`--font-mono`）とは独立した軸なので、`text-mono` に `font-mono` を組み合わせるなど併用する。

| トークン         | 値               | 用途                                                 |
| ---------------- | ---------------- | ---------------------------------------------------- |
| `text-body`      | 12px / line 1.4  | 主要本文（作品タイトル・行の主テキストなど）         |
| `text-secondary` | 11px / line 1.35 | セカンダリ情報（タグ値・補助テキスト）               |
| `text-caption`   | 10px / line 1.3  | キャプション・空状態・補足ヒント                     |
| `text-control`   | 11px / line 1    | ボタン・操作ラベル（`--font-sans`と併用）            |
| `text-label`     | 10px / line 1.2  | セクション見出し・カテゴリラベル（uppercase等）      |
| `text-mono`      | 11px / line 1.3  | 時刻・件数・パス等の数値/等幅表示（`font-mono`併用） |
| `text-badge`     | 9px / line 1     | 通知バッジ等、丸ピル内の極小数字                     |

13px以上（モーダル見出し・大きい数字表示など）はこのスケールの対象外で、個別に決めてよい。現在このスケールの外にあるのは以下（正は実装）。

- モーダル見出し（`h2`/`header`内のタイトル）: 14px（例: `WorkEditDialog`・`WorkInfoDialog`・`SmartFolderEditorModal`・`ScanModal`・`SettingsModal`・`RegisterWorkDialog`・`DlsiteEditor`・`DlsiteBulkApplyDialog`・`NotificationListModal`）
- 確認ダイアログの見出し（`ConfirmDialog`・`WorkEditDialog`の未保存確認）: 13.5px
- 起動時エラー画面（`RootErrorBoundary`・`StartupErrorScreen`）: ロゴのアバター文字 20px、見出し15px、本文13px
- セットアップ画面（`SetupScreen`）: ロゴのアバター文字20px、見出し22px、本文・送信ボタン13px
- トラックリスト見出し・トラックタイトル（`NowPlayingTrackList`）、タグ削除ボタン記号（`Tag`）、起動中表示（`App`）: 13px
- 再生画面のトラックタイトル見出し（`NowPlayingView`）: 24px

## フォーカス表示

操作可能な要素のうち、文字入力ではないもの（`button` / `a` / `select` / `[tabindex]` / チェックボックス・ラジオ・レンジ等の非テキスト系`input`）は `shell/base.css` の共通規則で一律 `2px solid var(--acc)` のリングを表示する。文字入力（`input[type=text]`相当・`textarea`）はキャレットで位置が分かるためアクセント色のリングを出さず、境界線色の弱い変化（`--line-strong`）だけで示す。共通規則は `layer(base)` にあり、枠線色を `border-line` 等のユーティリティで指定した入力には負けるため、そうした入力には `focus-visible:border-line-strong` を併記する。それ以外に個別コンポーネントで `focus-visible:outline-*` や `focus:ring-*` 等のTailwindユーティリティを重ねて再定義しない。`overflow: hidden` な一覧スクロール域内の行（`.mll-wrow` / `.mle-row`）だけ、リングが切り抜かれないよう `outline-offset` を `var(--focus-ring-offset-clipped)`（-2px）にする例外を個別に持つ。

## グローバルショートカット / Escape

再生系のグローバルショートカット（`useGlobalShortcuts`、Space=再生/一時停止、←→=±10秒シーク）とEscapeは、フォーカス位置・ダイアログの有無によって有効範囲が変わる。実装からは読み取りにくい規約なので明記する。

- モーダル `<dialog open>` が開いている間は、フォーカス位置に関わらずグローバルショートカットを全キー無効化する（dialog内でSpaceや矢印キーが背後の再生・seekを変えない）
- 除外セレクタ（ネイティブ操作を優先する）: `input, textarea, select, [contenteditable], [role="menu"], [role="listbox"], button, a`。フォーカスがこれらの中にあれば、Web標準どおりその要素自身の操作（テキスト入力・メニュー操作・ボタン活性化等）を優先し、グローバルショートカットは発火しない
- ただし常設プレイヤーの操作ボタン（再生/一時停止・前後トラック・±10秒・ループ・チャンネル入替・速度トリガー・音量トリガー）には `data-player-control` 属性を付与しており、この属性を持つ要素にフォーカスがあるときだけ、Spaceは通常のbutton除外をバイパスして常にグローバルの再生/一時停止に回る（矢印キーは対象外で、通常のbuttonと同じくネイティブ動作優先のまま）。判定は`data-player-control`属性で行い、クラス名の文字列一致やDOM構造の推測には頼らない。ボタン自身のネイティブSpace活性化とグローバル側の再生トグルが二重発火しないよう、preventDefaultでボタンの既定動作を止める
  - 付与した対象: `BarContent`（下部バー）・`PlayerTransportControls`（再生中タブ）・`PopupContent`（ポップアップ）・`NowPlayingImmersiveMiniControls`（没入モード）の各再生/一時停止・前後トラック・±10秒・ループ・チャンネル入替ボタン、`PopupContent`の速度トリガー（`mle-ratepill`、速度メニュー項目自体は`role="menu"`配下として従来どおり除外）、`BarVolumePopover`の音量トリガー
  - 意図的に付与しなかった対象: 停止・展開・折りたたみ・「再生中の作品を表示」等のナビゲーション系ボタン（再生状態を切り替える操作ではないため）、`ABRepeatBar`のA/B地点設定ボタン（再生状態を切り替える連続操作ではなく、その場で状態を確定させる一回限りのアクションのため、標準のSpace活性化のままでよい）
- Escapeはレイヤーごとに一段だけ閉じる（`TagCombobox`）。候補表示中のEscapeは候補だけを閉じ、ダイアログのcancelや親popoverのdismissへは伝播させない。候補が閉じているときのEscapeは、呼び出し元が渡した`onCancel`があればそれ（編集キャンセル等）を呼び、`onCancel`が無ければ何もせずネイティブ`<dialog>`のcancelへ素通しする
- IME変換中（`event.nativeEvent.isComposing`）はEscapeもEnterも無視する。変換の取り消し・確定はIME自身に任せ、候補の開閉・タグ確定・onCancelは発火させない

## 作品一覧・トラック一覧のキーボード操作

作品グリッド（`WorkGrid`）・作品リスト（`WorkListPane`）・トラック一覧（`WorkTrackList`）は共通のキーボード契約に従う。

- roving tabindex: 一覧内の各行/タイルは個別のTabストップにしない。「現在位置」に当たる1件だけ `tabIndex={0}`、他は `tabIndex={-1}` にし、一覧全体でTabストップを1個にする。作品グリッド・作品リストは「選択中の作品（無ければ先頭）」を現在位置にする（選択状態を持つため）。トラック一覧は選択の概念が無いため、初期値は「再生中のトラック（無ければ先頭）」とし、以降は行の`onFocus`で現在位置を更新する（フォーカスされた行がそのまま次のroving対象になる、標準的なroving tabindexの実装）
- 矢印キー: 上下（グリッドは左右も）で隣接する行/タイルへ移動する。移動先へは選択も追従させる（`onWorkSelect`）。グリッドの列移動は `gridNavigation.ts` の `getNextGridIndex`（固定列）/`getNextJustifiedIndex`（ジャスティファイド、隣接行で横位置が最も近いタイルを選ぶ）、リスト・トラック一覧は同じ `getNextGridIndex` を列数1で流用する（Up/Downが±1になる）。Home/Endは各関数が先頭・末尾のインデックスを返す
- 仮想化された一覧（グリッド・リスト）は、移動先が現在描画範囲外にあることがある。`virtualizer.scrollToIndex` でスクロールしてから、対象要素が実際にDOMへ現れるまで `requestAnimationFrame` でフォーカスをリトライする（`shared/lib/focusVirtualItem.ts`）。対象行は `data-flat-index` 属性（`works` 配列でのフラットな位置）で特定する。トラック一覧は仮想化していないため、行のrefへ直接 `.focus()` する
- Enter: その行の主アクション（作品グリッド・リストは再生、`work.status === "ok"` のときだけ。トラックは常に再生）。ダブルクリックも同じ主アクションを呼ぶ（グリッド・リスト共通）
- Escape: 作品グリッド・リストは、選択中の作品があるときだけ選択解除する（`useWorkResultsDismiss`、両者で共有）。モーダル`<dialog>`が開いている場合、フォーカスが `input`/`textarea`/`select`/`[contenteditable="true"]`/`[aria-expanded="true"]` の中にある場合は何もしない（他レイヤーの操作を横取りしない）。一覧の背景クリック（行/タイル以外）でも同じ選択解除を行う

## クラス命名

- `mle-`: Explorer / 共通シェル系（フレーム・カラム・アドレスバー・行など File/Library 共通の骨格）
- `mll-`: Library モード固有（軸レール・作品行・リッチ詳細・スマートルールなど）
- 状態は `is-` プレフィックス: 選択 = `.is-on`（paper-4 背景）、選択+フォーカス = `.is-on.is-focused`（黒地白文字に反転）。行・軸系コンポーネントを追加するときはこのパターンを踏襲する

`client/src/styles/shell/index.css`（および同ディレクトリ配下の分割 CSS）は全規則がカスケードレイヤー内にある。UA要素のリセット（`button` / `input` / `a` / `ul` / `ol` 等）は `@layer base`、`mle-`/`mll-` のコンポーネント規則は `@layer components` に置く。Tailwind v4 のレイヤー順（`theme, base, components, utilities`）により、`@layer utilities`（Tailwindユーティリティ）が `components` より強く効くため、tsx側で `mle-`/`mll-` クラスと Tailwind ユーティリティを併用すると、ユーティリティ側で局所的に上書きできる。レイヤー外に素のセレクタを書くと、レイヤーの規則（unlayered が常に layered に勝つ）で utilities を問答無用で潰してしまうため、セレクタを足すときは必ずどちらかのレイヤー内に置く。

フォント指定とUA要素のリセット（`@layer base` の `button` / `input` / `a` / `ul` / `ol`）は `body` セレクタでスコープする（`.mle-app` ではない）。アプリの DOM は `body` 直下に `#root`（= `.mle-app`）と、`createPortal(..., document.body)` で出すポータル要素しかないため、`body` にスコープしておけば新しくポータルを追加しても個別に打ち消しCSSを書く必要がない。ポータルを新規に追加するときはこの前提を壊さないこと（ラッパー要素にあえて別のフォント・リセットを指定したい場合を除き、何もしなくてよい）。

## 用語

ライブラリからの操作は常に「登録解除」と呼ぶ。ボタン・見出し・確認ダイアログ・トースト・結果文言すべてで統一し、「削除」は使わない。「削除」は物理ファイルに言及する文脈にだけ使う（例: 「音声などの物理ファイルは削除されません」）。コンポーネント名にも同じルールを適用する（`ErrorViewBulkUnregisterBanner` が実例）。

## Overlay / z-index の現在の階層

実装調査済みの値（正は実装）。

| 要素                                                                  | 層                    |
| --------------------------------------------------------------------- | --------------------- |
| 並び替えメニューのポップアップ                                        | z-index 30            |
| 軸のクイックオーバーレイ・チップの値ドロップダウン（`.mll-qoverlay`） | z-index 30            |
| プレイヤー（バー/ポップアップ）                                       | z-index 32            |
| 再生中タブ・下部帯の背景（`.mle-nowplaying__bg`）                     | z-index 32            |
| 再生中タブ・トランスポート/AB行（`.mle-nowplaying__controls`）        | z-index 33            |
| 再生中タブ・没入モード面（`.mle-nowplaying__immersive`）              | z-index 40            |
| 再生中タブ・シーク行（`.mle-nowplaying__seek`、没入面より常に手前）   | z-index 41            |
| 設定モーダル                                                          | top layer（下記）     |
| スキャンモーダル                                                      | top layer（下記）     |
| スマートフォルダーエディタ                                            | top layer（下記）     |
| 作品編集・DLsite適用プレビュー                                        | top layer（下記）     |
| **グローバルトースト**（`Toast` / `GlobalToast`）                     | **top layer（下記）** |

設定モーダル・スキャンモーダル・スマートフォルダーエディタ・作品編集・DLsite適用プレビューは
ネイティブ `<dialog>` + `showModal()` で実装しており、z-index ではなくブラウザの
top layer によって最前面に重なる（TASK-29）。開閉ライフサイクル・Escapeキャンセル・
backdropクリックの共通処理は `client/src/shared/ui/useDialogModal.ts` に集約している。
フォーカストラップと「多重モーダル時は最前面のEscだけが効く」挙動は top layer の
ブラウザ標準実装に任せる。Escape・×ボタン・backdropクリックの閉じ方は progressive
dismissal に統一しており、3経路とも `useDialogModal` の `onClose` 1本に集約する。
編集中は内側の編集だけをキャンセルしてモーダルは開いたまま、非編集時は閉じる。
保存中に閉じない等の条件は各モーダルが `onClose` 内で判断する。

グローバルトーストは `popover="manual"` + `showPopover()` で同じ top layer に載せ、
モーダル・ダイアログが開いていても通知が隠れないようにする（TASK-206）。表示は
`client/src/shared/ui/Toast.tsx` が `document.body` へポータルし、z-index では
モーダルより上に出せない制約を避ける。top layer 内の前後関係は表示タイミングの
新しい方が手前になるため、モーダル表示後にトーストを出せば常に最前面に見える。

ただし `showModal()` 中の dialog はブラウザが dialog 以外の全体を暗黙に inert 化するため、
popover で top layer に載せてもクリックは通らない。`Toast` は開いているモーダル
dialog を `useTopmostOpenModalDialog`（`shared/ui/`）で検出し、そのdialog直下へポータルする
ことでこれを回避する（inert化の対象から外れる）。モーダルが無ければ `document.body` へ
ポータルする。モーダルが閉じれば body へ戻る。

### Toast は単一ホスト（GlobalToast）に集約する

`Toast`（`shared/ui/Toast.tsx`）を描画する場所は `GlobalToast`（`app/ui/`）1箇所だけに
限定する。個々の画面が独自に `<Toast>` を宣言することは禁止する（`rg "<Toast\b" client/src`
で `GlobalToast.tsx` 以外に一致しないことを常に保つ）。表示を出したい側は
`useToast`（`shared/ui/useToast.ts`）フックで表示要求を出す。要求は
`{ message, variant, actionLabel?, onAction?, onDismiss?, priority }` の形で、
`priority` は次の2値のいずれか。

- `"action"`: ユーザーが直前に行った操作の直接の結果（元に戻す・完了フィードバック等）
- `"background"`: スキャン・DLsite一括取得等、非同期ジョブの結果通知

以前は「各画面が自分の判断でdialog内かdocument.bodyかを選ぶ」形だったため、GlobalToast
（アプリルート）が偶然同じタイミングで表示要求を出すと、2つの独立したToastインスタンスが
同じ固定位置（モーダルdialog直下）へ同時にポータルされ、一方が他方のボタンを覆って操作
できなくなる不具合があった（スキャンダイアログでDLsite一括取得完了トーストと
候補除外のUndoトーストが重なるケースで発生）。単一ホストに集約し、`GlobalToast` が
「今どの1件を表示するか」を優先度チェーンで決めることでこの衝突を構造的に無くす。

優先度チェーンは次の順（上が勝つ）。`GlobalToast.tsx` の if 連鎖の並びそのものが正で、
このリストは実装から乖離させない。

1. `variant === "error"` の通知（`scanError`・`errorToast`・DLsite一括取得のエラー。
   読み落とし厳禁のため自動消滅せず手動クローズのみ）
2. `useToast` の `priority: "action"` 要求
3. その他の個別グローバル通知（スキャン完了/中止・ルートフォルダー変更・トラック
   スキップ・ライブラリURL修復・DLsite関連の完了/中断/適用結果等。いずれも
   `variant !== "error"`）
4. `useToast` の `priority: "background"` 要求

**2と4（`useToast` 経由の要求）は選ばれなければ即座に破棄する。3（atomで保持する
個別グローバル通知）は選ばれなくても消えず、上位が消えるまで待ってから表示される。**
この違いは、2と4がその場限りの呼び出し側ローカル状態と1対1で結び付く要求
（呼び出し元コンポーネントが生きている間だけ意味を持つ）なのに対し、3はアプリ全体で
保持される状態（コンポーネントの生死と無関係に、消すまで居座る）だから生じる。

2・4が選ばれなかった場合、キューに積まず**即座に破棄する**（`GlobalToast` が
`useLayoutEffect` で毎回どの1件が表示対象かを求め、それ以外を `toastRequestsAtom` から
取り除いて `onDismiss` を呼ぶ）。上位の要求が消えても、既に破棄した要求が後から
改めて表示されることはない。待機（キュー）にすると「表示される前の待ち時間には寿命が
無く、上位が消えたタイミングで文脈を失った古い状態のトーストが不意に出る」問題が起きる
ため採らない。破棄した要求の内容は、必ず別の場所から辿れることを要求元が
保証する（例: DLsite一括取得の結果は `GET /dlsite/bulk` の直近結果と通知ベルから確認
できる。候補除外のUndoは設定モーダル「候補から外したフォルダー」で後から取り消せる）。
別の場所から辿れない一度きりの操作（例: タグ削除のUndo）は、破棄されても
致命的ではないと判断できる場合に限り許容する（負ける相手が手動クローズのみのerrorに
限られ、再実行が1操作で済むなど）。

### Toast の表示寿命・種別

`variant`（`"info" | "success" | "warning" | "error"`）で成功・警告・失敗をアイコンと
`--state-success` / `--state-warning` / `--state-danger`（`tokens.css`）の配色で区別する。
表示寿命は種別ではなくaction有無で決まる： action無しは5秒（`TOAST_AUTO_DISMISS_MS`）、
action付きは10秒（`TOAST_ACTION_AUTO_DISMISS_MS`）で自動的に閉じる。hover中・内部要素への
focus中はタイマーを止め、離れると残り時間から再開する。`variant="error"` だけは自動消滅
せず、× ボタンでの手動クローズのみとする（エラーは読み落とし厳禁のため）。

## ライブラリ: チップ列・値一覧行・オーバーレイ

方針の正は [ADR-0012](adr/0012-library-axis-as-value-browse.md)。実装からは読み取りにくい規約だけをここに記す。

チップ列（`.mll-tagband`、`FilterChipBand`）は選択フィルタが0件でも常に表示し、末尾の「＋絞り込み」から最初の1件を追加できる。チップの表示文字列は軸を問わず常にフルパスで、省略や軸名の非表示は行わない。ただし組み込み軸の擬似タグ（`@year/2023`等、`buildFilterTag`の出力そのもの）は内部表現のため、`formatFilterChipLabel`（`libraryPresentation.ts`）で「軸ラベル/値」（例:「追加日/2023」）に変換してから表示する。実タグはこの変換を通しても`tag`のまま変わらない。

値の選択操作（軸レールのクイックオーバーレイ・チップの兄弟値ドロップダウン・「＋絞り込み」・値一覧の行/タイル）は、`ValueSelectionIntent`（`client/src/features/library/model/valueSelectionContract.ts`）という単一の契約で表現する。各入口は「既定＝置き換え」「既定＝AND追加」のどちらかだけを宣言し、主クリックの意味・`Ctrl`/`Cmd`+クリックの反転先・追加ボタンの有無は `deriveValueSelectionHandlers` が一意に導出する。既定＝AND追加の入口では戻り値に追加ボタン用ハンドラが存在しないため、「AND追加が既定なのに追加ボタンあり」のような組み合わせは型で表現できない。置き換えは結果面を作品一覧へ進め、AND追加は現在の結果面に留まる（置き換え＝「見たいものが変わった」、AND追加＝「絞り込みを積んでいる途中」）。

背後の action atom は3つある。`replaceLibraryTagAtom`（置き換え）、`toggleLibraryTagAtom`（`Ctrl`/`Cmd`+クリックによる反転先。選択済みなら解除する）、`addLibraryTagAtom`（追加ボタン・既定＝AND追加の主クリック用。冪等で、選択済みなら何もしない）。追加ボタンは常に `addLibraryTagAtom` を呼ぶため選択済みタグを解除せず、選択済みの行には追加ボタン自体を表示しない。コンポーネント側でこれらの action atom を直接分岐させず、必ず `ValueSelectionIntent` を宣言して `deriveValueSelectionHandlers` を経由する。

軸ファセット件数（`GET /axes/:axis`）の「件数基準」も同じ契約から導出する。既定＝置き換えの入口（軸レールのクイックオーバーレイ・チップの兄弟値ドロップダウン・値一覧の行/タイル）は無条件集計（現在の選択タグを一切渡さない）にし、その行を主クリックした結果（選択タグを丸ごと1件に置き換えた後の件数）と画面の表示件数を一致させる。既定＝AND追加の入口（「＋絞り込み」）は現在の選択タグ込みの集計のままにし、「追加したら何件になるか」を示す。どちらの集計を使うかは `deriveFacetCountTags(intent, selectedTags)` で導出し、呼び出し側でハードコードしない。

値行（`AxisValueQuickList`・`AxisValueRows`・`AxisValueGrid`）は `role="listbox"` / `role="option"` を使わない。行は主選択ボタンとAND追加ボタンという2つのフォーカス可能要素を内包しており、ARIAのoption roleが想定するテキスト相当の内容とは合わないため、listboxパターン自体を採らない。行のコンテナは無地の `div`（仮想化の絶対配置ラッパーと責務が重なるため `ul`/`li` は使わない）で、選択状態は実際にフォーカスされる主選択ボタン自身の `aria-pressed` で表す（`WorkTile` の単一ボタンタイルと同じ表現）。3コンポーネントとも roving tabindex で、一覧内の各行を個別のTabストップにせず「現在位置」の1行だけ `tabIndex={0}`、他は `tabIndex={-1}` にする（作品一覧・トラック一覧と同じ規約）。一覧全体でTabストップは1個になり、Tabで一覧へ入ると現在位置の行にフォーカスし、もう一度Tabすると一覧全体を抜ける。矢印キーでの行移動は自前のフォーカス制御で行い、ARIAのlistbox/optionキーボード規約には従わない。移動先を特定する目印は統一されておらず、`AxisValueQuickList` は `data-index` / `data-quicklist-item`、`AxisValueRows` と `AxisValueGrid` は `data-flat-index` を使う。行をまとめるスクロールコンテナ（`.mll-qlist__body` / `.mle-col__list` / `.mll-grid-scroll`）には `role="group"` と `aria-label="{軸名}の値一覧"` を付け、複数のフォーカス可能要素を子に持てる集合として名前だけは伝える。軸名は各コンポーネントが `axis`（ID）から自前で `getAxisLabel(axis)` を呼ばず、呼び出し元が `getAxisLabel(axis, tagPrefixes)` で解決した表示ラベルを `axisLabel` propとして受け取る（tagPrefixesを渡さないと未登録prefixでIDがそのまま支援技術に通知されるため）。軸レールのトリガーボタン（`AxisColumn`）は開くパネルが `menu`/`listbox` いずれのパターンでもないため `aria-haspopup` を持たず、開閉状態は `aria-expanded` のみで表す（disclosureパターン）。

入れ子タグ（スラッシュ複数）の階層表示は名前順ソートのときだけ有効で、件数・総時間ソートではフルパスの平坦表示にフォールバックする（`axisValueHierarchy.ts`）。中間ノードは実際にタグとして存在する場合だけ選択可能な値行（配下の見出しを兼ねる）になり、存在しない場合は選択不可の見出し行になる。「配下を含む絞り込み」は作らない（ADR-0005 §6 の完全一致セマンティクスと衝突するため）。グリッド表示ではタイルの正方形の都合上インデントは付けず、代わりに葉ラベルの上に親パスを小さく添える。

軸レールのクイックオーバーレイは軸カラム（`overflow: hidden auto`）の外にはみ出すため `document.body` へポータルする。チップの値ドロップダウン・「＋絞り込み」はクリップされない領域にあるため非ポータルの絶対配置で済ませる。両者とも横方向のクランプは `client/src/shared/ui/useAnchoredPopover` の `getContainer` オプションでクランプ対象コンテナ（floating-ui の `shift` / `size` の `boundary`）を差し替える。複数のトリガーが1つのポータル越しパネルを共有し常に高々1つだけ開くホバーUI（軸レールのクイックオーバーレイ等）は `useHoverGroupCoordinator`（`shared/lib/`）を使う。開閉タイマーの共有に加え、トリガーからパネルへの斜め移動が他のトリガー行の上を通過してもセーフトライアングル判定で開閉が横取りされない。

クイックオーバーレイ（`AxisValueQuickList`）は結果面の値一覧（`AxisValueRows` / `AxisValueGrid`）と同じデータ・ソート・階層化ロジックを共有するが、表示密度は意図的に異なる。オーバーレイはポップオーバーで横幅が限られ、行の padding・行高も独自定数（`.mll-qlist__item` の 6px + 12px 行）で詰めている。入れ子タグの階層インデントもメイン一覧（14px/段）より狭い 12px/段にして、狭いパネル内でラベルが読める横幅を確保する。ソート状態（`axisValueSortAtom`）はメイン一覧と共有し、オーバーレイのソートメニュー・結果面のソートメニュー・list 列見出しは同じ state への別入口である。

## Motion / cursor

方針の正は [ADR-0014](adr/0014-motion-reintroduction-presence-removal.md)。実装からは読み取りにくい規約だけをここに記す。

- 構造的なモーション（要素の出入り・スライド等）は `motion`（`motion/react`）の `AnimatePresence` で実装する。マウント境界は `{open && <Child />}` の条件レンダーにし、duration・easing・delay は `client/src/shared/ui/useMotionVariants.ts` の variant ビルダーに集約する。**`transition.delay` の直書きは禁止**（reduced-motion 時の 0 化を迂回するため）。delay が要る場合はビルダーのオプション経由にする
- 汎用ラッパーコンポーネントは作らない。共有するのはトークン（variant ビルダー）と規約のみで、各所で motion コンポーネントを直接使う
- 既存ルート要素は直接 `motion.div` 等に置き換える（ラッパー DOM を被せない）。ただし collapse でルート要素に padding/border がある場合は、`overflow: hidden` だけを持つ無地のラッパーを 1 枚だけ被せる
- `layout` / `layoutId` は使わない（過去にカバー歪みで撤去済み）。スコープは出退場・opacity・transform・width・height(0↔auto) に限定する
- fade の退出 `position: absolute` は最も近い positioned ancestor を基準にする。fade を使う箇所ごとに祖先が positioned かを確認する
- AP 境界の子は必ずコンポーネントとして切り出し、内部で `useIsPresent()` を呼ぶ。用途は (a) ルート要素への `inert={!isPresent}`、(b) document/window レベルのリスナー（outside click・Escape 等）の退出中解除、(c) 再オープン時の初期フォーカス（退出アニメ中に同じ対象が開き直されたときに入力欄へフォーカスし直す）の 3 つに限定する。**閉じたときのフォーカス復帰には使わない** — 復帰は `activeElement` を検査して reason を渡す close ハンドラ側の責務。`isPresent` で復帰させると、対象を素早く切り替えたときに退出中の旧要素が新要素からフォーカスを奪う
- クエリ購読は開閉状態に連動させない（`useXxxQuery(isOpen ? a : null)` のような引数の null 切替をしない）。子がマウントされている間は常に有効な引数で購読する
- `MotionConfig reducedMotion="user"` は transform/layout のみ抑止し、opacity アニメは止まらない。`useMotionVariants` が reduce 時に全 variant の duration/delay を 0 にすることで opacity アニメも実質即完了させる
- hover は短い transition のみで十分。派手な演出は避ける
- 操作不能な要素は `cursor: not-allowed` にする
- 長時間ループするアニメーション（パルス等）は reduced motion 対応を原則とする

## テキスト選択

UI 全体は `client/src/styles/shell/index.css` の `@layer base` で `body { user-select: none }` を既定とする（初回セットアップ画面・`document.body` へポータルするダイアログも含む）。`input` / `textarea` / `select` は同レイヤーで `user-select: text` を明示し、入力・IME・フィールド内選択を維持する。

コピー需要のあるテキスト（物理パス、RJコード、エラーメッセージ、CLI 例文、ルートフォルダーパス、作品情報ダイアログ本文など）は `.mll-selectable` を付与するか、既存のパス・警告・エラー用クラス（`.mle-prv__warn-path` / `.mle-fprev__path` 等、`client/src/styles/shell/` 配下 CSS の `@layer components`）で `user-select: text` に戻す。一覧・グリッド・ファイル行のラベルは操作と競合するため選択可能に戻さない。

## アイコン

アイコンは `client/src/shared/ui/Icon.tsx` の `I` レジストリに集約する。呼び出し側は必ず `I.xxx` 経由で参照し、`lucide-react` を直接importしない。ライブラリ選定の経緯は [ADR-0009](adr/0009-icon-library-lucide.md)。

- 一般的な意匠で足りるアイコンは `lucide-react` から取得して `I` に登録する。製品固有の意匠（`ratio11`・`gridJustified`・`loopOne`・`swapLR`・プレイヤー系の塗り表現など、一般カタログに対応がないもの）は自作を維持し、同じ `I` に追加する
- stroke幅（1.5）・`currentColor`・`aria-hidden="true"` はアダプタ層（`Icon.tsx`）で固定する。呼び出し側やベンダー固有propsをこれらの値に触れさせない
- サイズは `IconButton` のサイズ契約（`sm`/`md`/`lg` = 箱26/30/38px、アイコン14/16/20px）に従う。呼び出し側で独自の数値を散らさない
- SVGは装飾（`aria-hidden`）とし、意味は `IconButton` 側の `aria-label` が担う。名前を持たないアイコン単体での使用を避ける

## ボタン

テキストラベルを持つ操作ボタンは `client/src/shared/ui/Button.tsx` に集約する（アイコンのみのボタンは `IconButton`）。生の `<button>` を都度スタイリングしない。

- サイズは `sm`（既定・26px）/ `md`（34px）/ `lg`（36px）の3段。いずれも `rounded-pill` の錠剤形で統一し、サイズで角丸の形状は変えない
- variantは `primary`（主操作）/ `ghost`（副操作）/ `quiet`（主操作と対になるキャンセル）/ `danger`（破壊的操作の確定、coral塗り＋白文字）/ `danger-quiet`（進行中の操作を止めるだけの中止、coralの淡い背景＋アウトライン）の5種
- `quiet` は「確定操作の隣に並ぶキャンセル」専用。単独で置かれるフッターの「閉じる」（対になる確定操作が無いモーダルの離脱ボタン）は `quiet` にしない。`quiet` は背景が透明でホバーするまでボタンと分かりにくいため、常時可視の背景が要る単独の離脱操作には `ghost` を使う（`SettingsModal` フッターの「閉じる」が実例）
- `danger` と `danger-quiet` は重みが異なる。取り消せない操作の最終確定（`ConfirmDialog` の確定ボタン等）はダイアログ内で最も目を引く必要があるため `danger` を使う。進行中の処理をその場で止めるだけの操作（ツールバー・フッターの「中止」）はより控えめな `danger-quiet` を使う
- モーダルのキャンセルは `quiet`、閉じる（×）は `IconButton` を使う。ヘッダーの×ボタン用に生の`<button>`でアイコンだけを描画しない
- `motion.button` 等 `<button>` を直接使えない箇所は、`Button` と同じクラスを `buttonClass(variant, size, options)` から取得して適用する（`ScanFooter` / `TopBar` のAnimatePresence配下ボタンが実例）
- 破壊的操作の確認ダイアログ `ConfirmDialog` は内部で `Button`（キャンセル=`quiet`、確定=`danger`、いずれも`size="md"`）を使う

## モバイルレイアウト

方針の正は [ADR-0006](adr/0006-mobile-ui-strategy.md)。要点のみ:

- ブレークポイントは 768px の単一分岐（`tokens.css` のトークンが正）。768px以下は `AppShell` でなく `MobileShell`（ボトムタブ＋ミニプレイヤー）に切り替える設計（[ADR-0006](adr/0006-mobile-ui-strategy.md) 承認済み、`MobileShell` 自体は未実装）
- デスクトップ側コンポーネントに `md:` ユーティリティを散らして畳まない。操作系が異なるものはモバイル用ビューを別コンポーネントとして持つ
- スマホには管理系UI（タグ編集・スマートフォルダー編集・スキャン・設定）を持ち込まない。書き込みは「お気に入り」「あとで整理」タグのトグルのみ

## ブラウザテスト（smoke）の運用

最終確認は目視で行う方針のため、ピクセル比較（スクリーンショット差分）は行わない。`client/tests/smoke/library.smoke.spec.ts`（`pnpm test:smoke` で実行）はスクリーンショットを撮らず、role/text ベースのアサーションで「アプリが壊れていないか」を確認する自動網に徹する。

- smoke が赤いときは常に実際の不具合を意味する。見た目の変更では落ちないよう、対象範囲を撮影せず role/text ベースのアサーションだけで組み立てる
- コンソールエラー・未捕捉例外・4xx/5xxレスポンス・ネットワークリクエスト失敗が出ていないことも各テストの末尾で確認する（`support.ts` の `trackErrors` / `assertNoErrors`）
- レイアウトに関わる変更をするタスクでは、そのタスクの受け入れ条件・完了確認に `pnpm test:smoke` の結果（新規失敗が増えていないか）を含める

## 将来UIの参考資料

スマートフォルダー条件エディタの新規作成フロー、複数chミキサーの詳細意匠、左ナビのラベル付き案、統計/メモ/詳細トラック表を含む拡張作品詳細のモックは、いずれもフェーズ1未実装の将来UI案として Git 履歴の削除前ディレクトリ（`docs/design_handoff_mimimilli_library/`、2026-07-03 削除時点のコミット）から復元できる。着手時に参照する。

## 見送ったUI案

同じ提案を繰り返さないための記録。案と却下理由だけを書く。

- ファイルモードの折り畳み帯に、ルートから現在地の親までの祖先を背表紙で積み上げる — 見た目が重い。祖先へ戻る導線はアドレスバーのパンくずで足りる
- プレイヤー展開ポップアップの占有高さを測り、グリッド末尾と右ペインにその分の余白を足して重なりを避ける — 画面下の大部分が空いて意味の分からないUIになる
- 作品プレビューを一覧と並ぶレイアウト上の項目にし、狭幅では全幅オーバーレイへ切り替える — 開閉のたびに一覧が組み直されてちらつき、カードの寸法と列数も変わる。全幅の詳細は操作しづらく、狭幅はスマホ向けの画面構成で扱う
- 軸レールの各軸に件数を出す — 値の個数か作品数か区別できない。表示のたびに軸数×スマートフォルダー数の全件集計が走る
- 要対応タブのID重複を Work ID 単位に束ね、「別作品として取り込む」をその場で実行させる — 表示が分かりづらい
- ライブラリの不正なURLを自動で正当な画面へ戻し、トーストで知らせる — 不正なURLは404のまま見せる
