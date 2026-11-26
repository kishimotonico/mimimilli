---
id: doc-11
title: TASK-529.2 ポップオーバーの Ark 置き換え 設計（合意済み）
type: specification
created_date: '2026-11-26 09:27'
updated_date: '2026-11-26 09:34'
---
# TASK-529.2 ポップオーバーの Ark 置き換え 設計（合意済み）

状態: 設計レビューと決定を反映済み。実装は未着手。この文書と TASK-529.2 の実装メモだけで実装できるように、決定と理由を書く。
基点: ブランチ task-529.2-ark-popover（統合ブランチ feat/task-529-ark-ui の 9f774ff6 から分岐。TASK-529.1 のメニュー置き換えを含む）。
根拠: コード読みと zag popover 1.47 / Ark UI 5.40.0 のソース読み。ブラウザでの実測はまだ無く、§13 の検証計画で確かめる。
見た目の基準はこの文書の §6 が正で、モックの URL を開く必要は無い（モックを読めない環境でも実装できるように書き写してある）。

## 0. 前提

- 旧フックの呼び出しは6か所・6ファイル: GroupValuePopover、FilterChipAddButton、WorkEditTagsField、WorkTagEditor、RegisterFieldsPopover、BarVolumePopover（useAnchoredPopover は前の4つ、usePopoverDismissal は後ろの2つ）。タスク説明と AC1 の「約12箇所」は、この文書の §1 の #1〜#8（#6 の narrow 表示を除く）を指す。見かけの数が多いのは、呼び出し元（サイドバー・パンくず、「＋絞り込み」の2段、WorkTagEditor の narrow 表示）まで数えた見かけの数。Lightbox は dialog で、`popoverScale` の variant を借りているだけなので対象外
- 型だけの依存: GroupValuePopoverPanel と FilterChipAddButton が `AnchoredPopoverFloatingRefCallback`、RegisterFieldsPopover と UnregisteredFooter が `PopoverCloseReason`。コメントの言及: GroupValueQuickList の `close` の説明、useHoverGroupCoordinator の外側 pointerdown のコメント、BarVolumePopover の冒頭コメント。いずれも書き換え・削除する
- `@floating-ui/react` を直接 import しているのは useAnchoredPopover と usePopoverDismissal だけ。削除すれば直接依存は残らず、client/package.json から外せる
- AC4 の「ポップオーバーの中のメニュー」は、今のアプリに実在する箇所が無い（QuickList のソートはインライン展開）。決定と検証は、client/tests/unit/ の常設の vitest テスト（テスト内で Popover＞Menu を組み、userEvent で確かめる）で行う。本番コードに専用のルートやフィクスチャ画面は足さない
- 守る方針（TASK-529.1 で確定）:
  - フォーカスは、状態を変える側が直後に明示的に移す。body に落ちたのを検知して拾う補正、フレーム待ち、microtask の多段、他機能の状態遷移の観測はしない
  - 処理中の操作要素は `disabled` 属性でなく `aria-disabled`＋ハンドラのガードにして、フォーカスを落とさない
  - IME 変換中（isComposing / keyCode 229）の Esc・Enter で閉じも実行もしない
  - 層の中の自作の Esc 処理は `defaultPrevented` を見る
  - 汎用ラッパーは作らず、各所は Ark の部品を直接組む

## 1. 箇所の表

| # | 箇所 | トリガー | 開き方 | 中身 |
|---|---|---|---|---|
| 1 | LibrarySidebarPanel の GroupValuePopover（placement=right） | サイドバーの行（グループ分けを持つもの）。行の DOM は Ark のトリガーではなく、ids でトリガー扱いにする（§2） | ホバー約200ms（useHoverGroupCoordinator）、行にフォーカス中の ArrowRight | 検索欄＋ソート切替（インライン展開）＋仮想化リスト（値・件数・行の＋）。メニューなし・1段 |
| 2 | LibraryBreadcrumbs の GroupValuePopover（placement=below） | パンくずの値（Breadcrumbs が anchor 要素を渡す）。ids でトリガー扱い | クリック | 1 と同じ（＋ボタン無し） |
| 3 | FilterChipAddButton の GroupByPickerStage（1段目） | 「＋絞り込み」ボタン（`Popover.Trigger asChild`） | クリック | グループ分けのボタン一覧（listbox 表記）。選ぶと 2 段目へ |
| 4 | FilterChipAddButton の GroupValuePopoverPanel（2段目） | 同上（3 と同じ1つの層の中身） | 1段目で選ぶ | 1 と同じ一覧（＋ボタン無し） |
| 5 | WorkEditTagsField（native dialog の中） | 「タグを追加」IconButton（Trigger asChild） | クリック | TagCombobox（自作）。候補リストが開閉する |
| 6 | WorkTagEditor（右ペイン。expanded のときは dialog の中もありうる） | 「タグを追加」IconButton（Trigger asChild） | クリック | TagCombobox。右ペイン幅が 320px 未満のときは浮遊せず、チップ列下のフル幅の行に展開（今のまま。Ark を使わない） |
| 7 | RegisterFieldsPopover（UnregisteredFooter から。スキャンの native dialog の中） | トリガー無し。メニュー項目「項目を選んで追加…」（MenuLayerItem）から開く。ids のトリガーは ▾（SplitButton の▾ボタン）。位置合わせの基準は SplitButton の外枠 | メニュー項目 | チェックボックス4つ＋主ボタン「N件を追加」。role=dialog |
| 8 | BarVolumePopover（下部バー） | 音量ボタン（Trigger asChild） | クリック | range スライダー＋値 |

## 2. Ark の部品と設定

共通: すべて `Popover`（HoverCard は使わない。ホバーの意図判定・セーフトライアングル・ArrowRight の即時オープンは useHoverGroupCoordinator が持ち、中に入力欄があって HoverCard の想定と合わない）。`modal: false`、`portalled: true`、`open` はアプリの状態で制御、`lazyMount`/`unmountOnExit` なし。退出は TASK-529.1 と同じ「Root の `present`（`usePresenceLifetime`）＋内側の AnimatePresence」。positioning は `strategy: "fixed"`、`gutter: 6`、`overflowPadding: 8`、`fitViewport: true`。Portal の container は「アンカー／トリガーが native dialog の中ならその dialog、popover の content の中ならその content、なければ body」（`layerContainer`）。z-index は content の class の `z-50`（zag が content の z-index を positioner へ写す。メニューと同じ）。

トリガーの無い層（#1・#2・#7）: Ark の `ids={{ trigger: <アンカーの id> }}` でアンカー要素をトリガーとして登録する。#1 は行のボタン、#2 はパンくずの値、#7 は ▾（外枠の div ではない）。これで、トリガーを前提にした zag の機能が効く: Tab の proxyTabFocus、dismissable の exclude（アンカーの再クリックで outside 扱いにならない）、setFinalFocus のトリガーへのフォールバック。位置合わせは `positioning.getAnchorRect` のまま（#7 は外枠の矩形、他はアンカー要素の矩形）。ids がこの用途で効くかは、実装の最初に §13 の合否表で確かめる（効かなければ `persistentElements` と手動のフォールバックで代える）。ids で足りるなら `persistentElements` は使わない。

| # | 構造 | 主な設定（共通以外） | 位置・幅 |
|---|---|---|---|
| 1 | 行ごとに Root を持つ `SidebarQuickOverlay`（グループ分けを持つ行の数だけ）。`open = overlayFolderId === row.id && !editing`。データは行の folder から常に引けるので、退出中の凍結は不要 | ids.trigger=その行のボタン。アンカー矩形は getAnchorRect。`initialFocusEl`=検索欄。`onOpenChange`: `if (!open && openKey === row.id) close()`（§5） | right-start、flip なし、幅 280 |
| 2 | `view` がある間は常にマウントし、`open = siblingAnchor !== null` | ids.trigger=パンくずの値。`initialFocusEl`=検索欄。`onOpenChange`: `siblingAnchor` が自分のアンカーのときだけ `setSiblingAnchor(null)` | bottom-start、flip あり、幅 240 |
| 3・4 | 1つの Root・1つの Content。中身を stage（`pickedGroupBy` の有無）で切替 | `Popover.Trigger asChild`。`onEscapeKeyDown`: stage 2 なら `preventDefault`（Ark に閉じさせない）して stage 1 へ戻す。`initialFocusEl`: stage 1=1行目の項目。stage 切替の移動は §4 | bottom-start、幅 240 |
| 5 | Root＋`Popover.Trigger asChild`（IconButton）。container=dialog | `initialFocusEl`=コンボボックスの入力欄。`onEscapeKeyDown`: 常に `preventDefault` して Esc を TagCombobox に任せる（§5）。追加ボタンは `aria-disabled`＋ガード（`onOpenChange` で `open && disabled` を弾く） | bottom-start、幅 260 |
| 6 | 5 と同じ。narrow のときは Ark を使わず今のインライン行 | 5 に加え `positioning.boundary`=`.mle-prv__meta` / `.mle-prv__body`（今の getContainer と同じ）。コンテナ幅は `useElementWidth`（ResizeObserver）。narrow の判定は、層が開いている間は固定する | bottom-start、幅 260 |
| 7 | Root（`open` は UnregisteredFooter の `pickerOpen`）。container=dialog | ids.trigger=▾。getAnchorRect=SplitButton 外枠。`initialFocusEl` は既定（最初のチェックボックス） | top-end、幅 220 |
| 8 | Root＋`Popover.Trigger asChild`（音量ボタン） | `initialFocusEl`=スライダー。content で `onClick`・`onPointerDown`（バーに `onKeyDown` があれば同様にそれも）を `stopPropagation`（portal 越しの React イベントがバー本体の onClick＝ポップアップ展開へ届くため） | top（中央）、幅は内容 |

初期フォーカスは Ark の `initialFocusEl`（raf）に一本化し、既存の自前フォーカス（QuickList の `useEffect`、RegisterFieldsPopover の `useEffect`、BarVolumePopover の `useEffect`、ポップオーバーから渡す TagCombobox の `focusOnMount`）は消す。`initialFocusEl` は、Root が閉じた状態でマウントされ `open` が false→true になるときだけ効く（zag は最初から open でマウントされたときは初期フォーカスを実行しない）。#1 を行ごとの Root にするのはこのためでもある。

## 3. 初期フォーカスの位置

| # | 位置 | 現状との差 |
|---|---|---|
| 1・2 | 検索欄（ホバーで開いても移す。今の挙動のまま） | 同じ |
| 3 | 1行目の項目 | 今は移さない。付く |
| 4 | 検索欄（stage 切替時に呼び出し側が移す。§4） | 同じ |
| 5・6 | コンボボックスの入力欄 | 同じ |
| 7 | 最初のチェックボックス | 同じ |
| 8 | スライダー | 同じ |

## 4. フォーカスの戻し先と責務

戻し先の解決は共通フック `useMotionPopover` の1か所（`resolveReturnTarget()`）。Ark の `finalFocusEl` と、確定ハンドラが呼ぶ `closeAndReturn()` が同じ関数を使う。

`resolveReturnTarget()`:
1. `document.activeElement` が、body でなく・接続されていて・自分の content の外なら、それを返す。他の状態変更者がすでに移した先（確定ハンドラの明示移動、stage 切替、軸A→B で B が取ったフォーカス、プログラムの `focus()`）なので、Ark の復帰は no-op になる。zag 1.47 は focus-outside で閉じるときも restoreFocus を true のまま閉じる（popover.machine の trackDismissableElement の onInteractOutside は、フォーカスできる要素への pointerdown でだけ false にする）ので、`focus()` で外へ移ったフォーカスを奪い返さないためにもこの分岐が要る
2. 開く前の要素。`open` が false→true になる layout effect で記録する。記録は `resolveFocusReturnTarget(document.activeElement)`（メニュー内にフォーカスがあればそのトリガー）を拡張したもの。記録する要素が別の開いているポップオーバーの content の中なら、その持ち主の「開く前の要素」を引き継ぐ（A→B と移ると B の「開く前」が A の検索欄になり、A がアンマウントされて戻し先が切れるため）。content→戻し先は WeakMap で引く。メニュー項目（MenuLayerItem）から開いた層は、これで ▾ が引ける（RegisterFieldsPopover の `querySelector('[aria-haspopup="menu"]')` と、Esc での2回 focus が消える。useDialogModal と同じ関数に拡張を一本化する）
3. それが無い・切れていれば、トリガー／アンカー（ids のトリガー）

1 は「body に落ちたのを拾う補正」ではない。層が閉じるときの戻し先を決める関数の分岐で、フレーム待ちも後追いの監視も無い。

確定のとき: 確定ハンドラが `closeAndReturn()` を呼ぶ。同期で `resolveReturnTarget()` の先へ `focus({ preventScroll: true })` してから `onOpenChange(false)` する。その後に走る Ark の戻し（raf）は 1 で no-op になる。公開 prop の `restoreFocus=false` でも Ark の戻しは止められる（zag は閉じる時点の `prop("restoreFocus")` を読み、false なら戻さない。Ark 側から閉じたときは `event.previousEvent?.restoreFocus` で判定が引き継がれる）が、1 が同じ結果を出すので、戻しの経路は `resolveReturnTarget` の1本にまとめる。

軸A→B で閉じる側 A: A の閉じが「並ぶポップオーバーへの切り替え」（coordinator の `openKey` が自分でなく別の行）のときは、公開 prop の `restoreFocus={false}` を A に渡して戻さない。A の戻しの raf と B の初期フォーカスの raf の順序に依存しないようにするため。A が単に閉じるときは `restoreFocus` を true のままにし、1・2・3 で解決する。

閉じ方 × 戻し先（全箇所共通。個別の差は備考）:

| 閉じ方 | 戻し先 | 責務 | 備考 |
|---|---|---|---|
| Esc | 開く前の要素→トリガー | Ark（finalFocusEl） | IME 変換中の Esc は `onEscapeKeyDown` で `preventDefault`（閉じない）。#3・4 の stage 2 の Esc は stage 1 へ戻し、フォーカスは直前に選んだ項目（`[data-group-by-key]`）へ、`flushSync(setPicked(null))` の直後に呼び出し側が明示的に移す。#5・6 は Esc を常に TagCombobox に任せる（§5） |
| 外側クリック（フォーカスできる要素） | クリックした要素 | Ark（`detail.focusable` で restoreFocus=false） | 例: ✎ 編集ボタンを押すと、閉じてそのボタンが動く |
| 外側クリック（フォーカスできない領域） | 開く前の要素→トリガー | Ark | ブラウザが約10ms body に置いてから戻るのは受け入れる例外 |
| focus-outside（`focus()` で外へ） | 移動先 | 上の 1 | ⌘K で検索欄へ移した場合、閉じて検索欄に残る |
| 確定 | 下の表 | 確定ハンドラ＝`closeAndReturn()` | #8 は確定が無い |
| キャンセル（TagCombobox の onCancel） | Esc と同じ | TagCombobox が呼ぶ `onCancel`＝`closeAndReturn()` | |
| スクロール | 開く前の要素→トリガー | 共通フック `useCloseOnAnchorScroll`（メニューと同じ判定: スクロールした領域がアンカーを含む） | 開いている間だけ登録 |
| トリガー再押下 | トリガー | #3・5・6・8 は Ark（トリガーは exclude で TOGGLE）。#1・2・7 は ids のトリガーが同じ扱い | |

確定ごとの移し先:

| # | 確定 | 移し先 | 理由 |
|---|---|---|---|
| 1 | 値を選ぶ（`onSelectValue`） | 開く前の要素。無ければ行 | 今は行。変えない |
| 2 | 値を選ぶ（`selectGroupValue`） | 開く前の要素→パンくずの値 | 選んだ後にパンくずが作り直されてアンカーが切れる件は、ids のトリガーが新しい要素に付け替わるかで確かめる。切れて body に落ちるなら、移動の直後にパンくずの値へ明示的に移す |
| 3 | グループ分けを選ぶ（層は閉じない） | stage 2 の検索欄 | `flushSync(setPicked(g))` の直後に `handle.focusInitial()` |
| 4 | 値を選ぶ（チップ追加） | 「＋絞り込み」ボタン | `closeAndReturn()` |
| 5・6 | タグを選ぶ | 「タグを追加」ボタン | `closeAndReturn()` で先に移してから `addTag`。保存中もボタンは `aria-disabled`＋ガード（`disabled` 属性にしない）で focus を落とさない |
| 7 | 「N件を追加」 | ▾ | `closeAndReturn()` を `onRegister` より先に呼ぶ。今は popover の unmount で body に落ち、行が消えたあと約50ms で隣の行へ移る。▾ は `aria-disabled` で残るので body を経由しない。選択が空になって SplitButton ごと消える（plan.kind="waiting"）ときは、既存の UnregisteredTab の focusRequest（body のとき隣の行→パネル）がそのまま受ける |

UnregisteredFooter の `onClose(reason)` と `reason === "escape"` で ▾ を手動 focus する分岐は消す。RegisterFieldsPopover の `onClose` は引数なしの `() => void` になり、`PopoverCloseReason` 型も消える。

## 5. Esc・AC3・AC4

### Esc の段（メニュー → ポップオーバー → dialog）

- Ark の dismissable layer が capture 段で最前面の層だけに Esc を渡す。native dialog は Ark が Esc を `preventDefault` するので cancel しない。TASK-529.1 でネイティブ dialog の中のメニューは確認済み。ネイティブ dialog の中のポップオーバーは ADR-0043 に「試していない」とあるので、今回確かめる
- QuickList の `onKeyDown` の Esc（`handleListKeyDown`・`handleSearchKeyDown`）は削除する（Ark に一本化）
- IME: `onEscapeKeyDown` で `isComposing || keyCode === 229` なら `preventDefault`。content の `onKeyDownCapture` で変換中のキーを項目の実行・矢印移動へ流さない（`ignoreComposingKey` はメニューから `layer/` へ移して共用）
- 層以外で Esc を受ける処理は `defaultPrevented` を見ているか: useWorkResultsDismiss・NowPlayingLayer は見ている（確認した範囲）。Modal・WorkMetadataActions・WorkEditDialog は実装時に再確認する

### TagCombobox の Esc

タグのポップオーバー（#5・6）では、Ark の `onEscapeKeyDown` で常に `preventDefault` して Ark に閉じさせず、Esc は TagCombobox に任せる。候補が開いていれば候補を閉じ、閉じていれば `onCancel`（＝`closeAndReturn()`）を呼ぶ。Esc の経路を TagCombobox の1本にする理由は、Ark の dismiss と TagCombobox の onCancel の二経路にすると、二重 close と順序依存が生じるため。`aria-expanded` を見る関数は作らない。TagCombobox を Ark の層に置き換える（ADR-0043 の置き換え順 4）ときに、この `preventDefault` を消す。

### AC4（ポップオーバーの中のメニューで外をクリック）

決定: ポップオーバーの外をクリックしたら、中のメニューごと閉じる（Ark の既定。実装なし）。クリックされた要素は普通に反応する。Esc は一段ずつのまま。
理由: 外側クリックの先は操作できる要素で、メニューだけ閉じると、その操作が走ったのにポップオーバーが開いたまま、という中途半端な状態になる。ポップオーバーは軽い層で、閉じても失うものがない。native dialog の backdrop は操作要素でなく、dialog が編集中の状態を持つので、TASK-529.1 のとおりメニューだけ閉じる（useDialogModal のガード）。
却下した案: メニューだけ閉じる（ポップオーバーの `onInteractOutside` で、自分の content の中にトリガーを持つ開いているメニューがあるときに `preventDefault`）。
ADR-0043 の帰結の該当行を「ポップオーバーは軽い層なので外側の操作を通す。backdrop は操作要素でないのでメニューだけ閉じる」と書いて差し替える。
メニューの container は、ポップオーバーの中から開いたものを「その content の中」へ出す（`layerContainer` を dialog→popover content の順で引く。DOM の包含で focus-outside・outside の誤判定を避ける）。検証は client/tests/unit/ の vitest テストで行う（本番コードに足さない）。テスト内で Popover＞Menu（必要なら native dialog＞Popover＞Menu）を組み、userEvent で、(1) 外側クリックで両方閉じること、(2) Esc が メニュー→ポップオーバー→dialog の順に1段ずつ閉じること、を確かめる。Ark の Esc・外側判定は矩形に依存しないので happy-dom で確かめられる。依存して測れない部分（矩形が0、native dialog の `showModal` と Esc の cancel、Ark dismissable の pointerdown・focus の外側判定が動かない等）が出た場合は、vitest で確かめられた部分は vitest に残し、確かめられなかった部分だけを Playwright の smoke のハーネスページに回す（下の「ハーネス」）。その旨を報告に書く。実在する画面の Esc の段（dialog＞ポップオーバー＞候補リスト）は #5 で実ブラウザ測定する。

ハーネス（vitest で確かめられない部分だけ）: テスト専用のページを client 配下のテスト用ディレクトリに置く（例: `client/tests/smoke/harness/popover-menu.html` と、本番の共通層・Ark を import する小さな tsx）。本番コードには入れない。smoke から `page.goto('/tests/smoke/harness/popover-menu.html')` のように開き、native dialog＞Popover＞Menu の3段の Esc と、案a の外側クリックをそこで測る。実装の最初に、Vite の root がどこか（`client/vite.config.ts`）、そのパスが dev サーバーと smoke の両方で配信されるかを確かめる。配信できなければ別の置き場所を決めて、報告に書く。

### 軸A→B（AC2）

- 試作（TASK-525）の軸A→Bの確認は Ark 5.40.1 で行ったもので、本番は 5.40.0。AC2 は本番の部品（5.40.0、行ごとの Root）で改めて測る（§13）
- 構造: #1 は行ごとに Root（`SidebarQuickOverlay`）。A の `open` が false、B の `open` が true になる（TASK-525 の試作 ProtoArkAxis と同じ形。試作は proto/task-525-ark-ui ブランチの client/src/proto/ProtoArkAxis.tsx）。今の「AnimatePresence の子を key で入れ替える1つの GroupValuePopover」は廃止する
- A の復帰が B の初期フォーカスを奪わない仕組み: (1) A の閉じが切り替えのとき A に `restoreFocus={false}` を渡し、戻しの経路自体を無くす。(2) それでも `finalFocusEl` が走る場合は、上の 1 で `activeElement` が B の content の中なら B の要素を返して no-op。(3) A が先に走って `activeElement` が行や body になっていても、B の `initialFocusEl`（raf）が最後に検索欄へ移す
- 外側 pointerdown は Ark の処理が次フレームに遅れ、速いクリックで別の層のトリガーを押すと、Ark 5.40.0（zag 1.47）の layer-stack の入れ子判定で後から開いた層も閉じうる（TASK-530 で 5.40.1 に上げて解消予定）。この設計は、閉じ方が coordinator の状態（`openKey`）で決まり、各 Root の `onOpenChange` が「自分が開いているときだけ」反応することで、遅延による順序の違いが結果に出ない形にしてあり、ライブラリの修正に依存しない
- `onOpenChange` の仕様: 行ごとの Root は `if (!open && openKey === row.id) close()`。A を開いたまま行 B をすばやくクリックすると、coordinator の即時 pointerdown を消したため、A の外側クリックの閉じは Ark の遅延（マウスは次の raf、タッチは click）になる。先に B が開き、その後に A の `onOpenChange(false)` が無条件に `close()` すると B まで閉じてしまうのを防ぐ。#2 も同じで、`siblingAnchor` が自分のアンカーのときだけ `setSiblingAnchor(null)`
- useHoverGroupCoordinator の document pointerdown（外側クリックで即時 close）は、Ark の dismissable と二重になるので削除する（`registerPanelEl`・token の仕組みは行ごとの Root でも同じ意味で残す）

## 6. 見た目（モックの書き写し）

見た目のモック（Artifact「メニューの統一案」。claude.ai の共有ページで、読めない環境でも実装できるよう、数値と構造をここに書き写す）。モックにあるポップオーバーは、タグ追加の1つだけ。

トークン（既存の design-system.md のトークンと同じ値）: 余白は `--paper-0`〜`--paper-4`、線は `--line`・`--line-soft`、文字は `--ink-0`〜`--ink-4`、強調は `--acc`、危険は `--state-danger`、角は `--r-1`=4px・`--r-2`=6px、影は `--shadow-pop`、本文は `--fs-body`=12px・行間 1.4（`--lh-body`）、`--fs-label`=10px、`--fs-mono`=11px、本文は日本語フォント（`--font-jp`）。

### パネル（ポップオーバー）

- 外枠はメニューと同じ: 地 `--paper-1`、枠 1px `--line-soft`、角 6px（`--r-2`）、影 `--shadow-pop`
- 内側の余白 12px（メニューは 4px）。幅 240px（モックの値。実装では各所の現状の幅 280/240/260/220 を保つ）。中の要素の間隔 8px（縦に並べるときの gap）
- 幅の既定はメニューと違い、内容幅の min/max ではなく固定幅
- 出入り: opacity 0→1 と scale .96→1 を 0.12s・ease-out。起点（transform-origin）は開く向きに合わせる（モックは左上）。reduced-motion のときは動かさない
- アンカーとの間 6px

### 検索欄・入力欄（モックの `.inp`）

- 高さ 28px、左右の余白 8px、枠 1px `--line`、角 4px（`--r-1`）、地 `--paper-0`、文字色 `--ink-0`、キャレットは `--acc`
- 検索欄の下線や、旧パネルの 6/8px の余白は持たない（12px の内側と二重になるため）

### 項目（モックの `.mi`。ポップオーバー内では左右 8px）

- 高さ 28px、左右 8px、角 4px、間隔（gap）8px、文字色 `--ink-1`、`white-space: nowrap`、カーソルは default、幅は 100%
- ハイライト（ホバーもキーボードも同じ）: 地 `--paper-2`、文字色 `--ink-0`
- 無効: 文字色 `--ink-4`
- 危険な項目: 文字色 `--state-danger`（常に赤）。区切り線の下に置く
- ラベルは 1 行で、長いときは省略記号（`overflow: hidden; text-overflow: ellipsis; min-width: 0`）
- 選択中の項目: 左のチェック列（14×14px、`--acc`、チェックは 12px・線の太さ 1.8・丸端）に、チェックだけを出す。背景・太字は使わない。チェックやラジオを含むリストだけ列を確保する（モックでは、含まないリストに列は無い）。QuickList の選択済みの値と、「＋絞り込み」の選択済みの値も同じ扱い
- 件数: 右端、`--ink-3`、等幅 `--fs-mono`（11px）、左に 16px の余白（`padding-left: 16px`）、`flex: none`
- 小見出し: 10px・太さ 600・字間 .08em・`--ink-2`、欧文フォント（`--font-sans`）、余白は上 6px・左右 8px・下 2px
- 区切り線: 高さ 1px、`--line-soft`。メニューでは上下 4px の余白。ポップオーバー内では余白 0 とし、パネルの gap（8px）で間を取って、枠内で完結させる

### モックのタグ追加ポップオーバーの構成（上から）

1. 枠付き入力（検索欄）
2. 候補のリスト（項目。2番目がハイライト）
3. 区切り線
4. 「新しいタグ「耳」を作る」の項目

### モックに無い部分（メニューの規定に合わせる）

- QuickList の仮想化リスト（行の高さは 28px に揃える。`ROW_ESTIMATE_SIZE` を 29→28。行間 gap 1px は今のまま）、ソート切替のインライン展開、行の「＋」ボタン（hover/focus で出る。選択済みの行には出さない）、読み込み中・エラー・0件の表示: モックに無い。メニューの規定（文字 `--fs-body`・`--ink-*`）に合わせる
- 「＋絞り込み」の 1 段目（グループ分けの一覧）: モックに無い。項目はメニューの項目と同じ（右端の「›」は今の `I.chev` のまま）
- RegisterFields（チェックボックス4つ＋主ボタン）、音量（スライダー）: モックに無い。余白 12px と外枠だけ合わせ、中身は今のまま
- 幅: モックは 240px。各所は現状の幅を保つ
- 候補リストが content の外へはみ出す場合の見た目: モックに無い。実装時に確かめる

### 出入りと z-index

- 出入りは `menuScale`（0.12s・.96→1）を使う。`popoverScale`（0.18s・.92→1）は Lightbox だけが使う
- z-index は 50（メニューと同じ）。クイックオーバーレイ等の 30、tag 系の 10、音量の 33 は廃止

## 7. 現状からの見た目・挙動の変化（ユーザーに見える差）

見た目:
- 外枠はメニューと同じ（角6px・枠 `--line-soft`・`--shadow-pop`・出入り 0.12s・アンカーとの間 6px）、内側の余白 12px。tag 系は枠なしだったので枠が付く。RegisterFields は角 8→6。音量は余白 8×10→12
- 出入り: tag 系・音量・RegisterFields は今までアニメが無かったので新規に付く。クイックオーバー等は 0.18s・.92 から 0.12s・.96 へ
- ポータル先が body か dialog になる（今のタグ・音量は親の中の絶対配置）ので、親の overflow で切られなくなる
- QuickList の検索欄は枠付き入力、項目は高さ 28px、選択済みの値は「背景＋太字」からチェック列へ

挙動:
- アンカー外のボタン（✎ 編集など）を押すと、今は開いたまま両方動くが、ポップオーバーが閉じてそのボタンが動く
- native dialog の中のポップオーバーを開いたまま backdrop を押すと、今は両方閉じるが、ポップオーバーだけ閉じる。useDialogModal のガードを `[role="menu"]:not([inert])` だけでなく popover の content（`[data-scope="popover"][data-part="content"]:not([inert])`）にも効かせる（`layerContainer` の `OPEN_LAYER_SELECTOR` に集約）
- アンカーを含む領域のスクロールで閉じる（メニューと同じ規則。今のサイドバーのホバー層は追従していた）。サイドバーをホイールでスクロールして閉じたあと、coordinator がポインター下の行を約200ms後に開き直して点滅しないかを測る。点滅する場合の抑止案: スクロール起因の close のときだけ、coordinator の「本物の pointermove を観測するまで開かない」フラグを倒す
- ホバーで開いた層を閉じたあとの戻り先が、「アンカー行」から「開く前にフォーカスしていた要素」になる。キーボード（ArrowRight）で開いた場合は行へ戻る
- 「＋絞り込み」の2段: 外枠は開くとき1回だけ scale する。段の切替は中身の opacity だけ（今は2枚の枠が重なって入れ替わる）。1段目の初期フォーカスが1行目に付く
- 「N件を追加」のあとの戻り先が ▾（今は約50ms の body 経由で隣の行の ⋮）
- 他は同じ（値の選択・チップ追加・Esc の段・IME・タグ保存・音量）

## 8. 共通層に足すもの

汎用ラッパーは作らず、各所は Ark の `Popover` を直接組む。TASK-529.1 の `client/src/shared/ui/menu/` から、メニューにもポップオーバーにも効く部品を `client/src/shared/ui/layer/` へ切り出す。メニュー側の import は書き換え、互換の再エクスポートはしない。

| ファイル | 中身 |
|---|---|
| shared/ui/layer/usePresenceLifetime.ts | menu/ から移動（変更なし） |
| shared/ui/layer/keys.ts | `isComposingKey`、`ignoreComposingKey`（MotionMenu から移動） |
| shared/ui/layer/layerContainer.ts | `dialogOf` の一般化。アンカー／トリガー要素から、所属する native dialog（またはポップオーバーの content）を返す。`OPEN_LAYER_SELECTOR` も置き、useDialogModal の backdrop ガードが使う |
| shared/ui/layer/useCloseOnAnchorScroll.ts | MotionMenu のスクロール監視の切り出し。open の間だけ登録 |
| shared/ui/layer/layerStyles.ts | `panelFrameClass`（角6・枠 line-soft・影・地・文字）。menu と popover の両方がここに依存し、popover が menu に依存しない |
| shared/lib/focusReturnTarget.ts | `resolveFocusReturnTarget` を、記録する要素が popover の content の中なら持ち主の戻し先を返すよう拡張（content→戻し先の WeakMap） |
| shared/ui/popover/MotionPopover.tsx | `useMotionPopover`（`usePopover` を包む。制御 open、positioning の既定、IME の Esc、`onFocusOutside`（自分の content から開いた層への移動は閉じない）、`resolveReturnTarget`、`closeAndReturn`、`focusInitial`、開く前の要素の記録、スクロール close、present の寿命。閉じている間は effect を登録しない）、`MotionPopoverRoot`、`PopoverPopup`（Portal＋Positioner＋`Popover.Content asChild` の motion.div＋退出中 inert＋content の class） |
| shared/ui/popover/popoverStyles.ts | `popoverPanelClass`（`panelFrameClass`＋p-3。幅は呼び出し側） |
| shared/ui/menu/menuStyles.ts | `menuPanelClass` を `panelFrameClass` を使う形に書き換え |
| shared/ui/useElementWidth.ts | ResizeObserver で要素幅を返す（#6 の narrow 判定） |
| IconButton | `disabled` 属性でなく `aria-disabled`＋クリックのガードで無効にする指定（`softDisabled`）。#5・6 の追加ボタンで使う |

`useMotionMenu` の対応する部分は同じ部品を使うよう書き換える（メニューの挙動は変えない。TASK-529.1 のテストで縛る）。

削除: usePopoverEscape.ts、useAnchoredPopover.ts、usePopoverDismissal.ts、client/tests/unit/useAnchoredPopover.test.tsx、client/tests/unit/popoverEscape.test.tsx、`@floating-ui/react`（client/package.json と lockfile。`pnpm remove`）、`.mll-qoverlay*` の枠・z-index・`--fixed/--inline`、`.mle-bar1__volpop` の枠・位置。`openModalDialogsAtom` は Toast が使うので残す。

## 9. docs の書き換え（節の名前で）

docs/design-system.md:
- Escape の節（ポップオーバーは usePopoverEscape で…の箇条書き）: メニューとポップオーバーが Ark の層で一段ずつ閉じる、タグのポップオーバーは Esc を TagCombobox に任せる、に書き換え
- 「Overlay / z-index の現在の階層」表: クイックオーバーレイ・「＋絞り込み」の 30 の行を消し、メニュー行を「メニュー・ポップオーバー」に（`menuPanelClass`／`popoverPanelClass`、body または所属 dialog へポータル、z-index 50）
- ボタン起点のメニューの規定（`shared/ui/menu/` の段落）: ポップオーバーの規定を追加（外枠はメニューと同じ、内側 12px、出入り、戻し先の解決、確定は `closeAndReturn`、スクロールで閉じる、`layer/` への切り出し）
- グループ値のクイックオーバー・パンくず・「＋絞り込み」を述べている節（サイドバーのクイックオーバー、パンくずの値、`useAnchoredPopover` の `getContainer`、`useHoverGroupCoordinator` の段落）: 行ごとの Root・Ark のポップオーバーの前提に書き換え
- Motion 節: AP 境界の `useIsPresent` の用途 (c)（再オープン時の初期フォーカス）を削除。「閉じたときのフォーカス復帰は close ハンドラの責務」を、ADR-0043 に合わせて「戻し先はアプリが決め、実行は Ark の `finalFocusEl`。`useIsPresent()` を復帰に使わない」に。`popoverScale` を使うのは Lightbox だけになった旨

docs/adr/0043-ui-primitives-ark-ui.md:
- フォーカスの節: ポップオーバーの戻し先の解決（1 すでに移っていれば動かさない、2 開く前の要素＝層の連鎖をたどる、3 トリガー）、確定は `closeAndReturn`、メニュー項目から開いた層の戻し先の解決を1か所にまとめたこと
- 帰結: 「ポップオーバーの中のメニューを開いたまま…外をクリックすると…」の行を AC4 の決定に差し替え。「ネイティブ dialog の中のポップオーバーは試していない」を確認結果に。`@floating-ui/react` を外した旨（「使う箇所が無くなった時点で外す」の記述）。backdrop ガードの対象にポップオーバーを含めた旨
- 置き換えの順番 2 の「`usePopoverEscape` を削除」は完了として整える

## 10. テスト

- 削除: useAnchoredPopover.test.tsx、popoverEscape.test.tsx
- 書き換え: GroupValueQuickList.test（Esc は Ark 側、初期フォーカスは呼び出し側）、FilterChipBand.test、LibraryBreadcrumbs.test、LibrarySidebarPanel.test、WorkTagEditor.test、WorkEditDialogTagEscape.test、TagComboboxEscape/Dismiss.test（Ark の中での Esc）、UnregisteredTab.test・focusAfterUnregister.test（N件を追加の戻り先）、useHoverGroupCoordinator.test（pointerdown 削除）
- 新規（client/tests/unit/）: ポップオーバーの中のメニュー（AC3 の Esc の段 メニュー→ポップオーバー→dialog と、AC4 の外側クリックで中のメニューごと閉じる）を、テスト内で Popover＞Menu（必要なら native dialog＞Popover＞Menu）を組み、userEvent で確かめる常設テスト。本番コードに専用ルートやフィクスチャ画面は足さない。Ark の Esc・外側判定は矩形に依存しないので happy-dom で確かめられる。依存して測れない場合は、その旨を報告に書く
- 新規: useMotionPopover（`resolveReturnTarget` の3分岐、連鎖の引き継ぎ、IME、`closeAndReturn`）、軸A→B（Root 2つ、B の検索欄が最後、A に `restoreFocus=false`）、`onOpenChange` の「自分が開いているときだけ閉じる」、ポップオーバーの中のメニュー（Esc の段と AC4 の決定）、backdrop ガード（popover）
- Ark の項目・トリガーは vitest で `fireEvent.click` が効かず `userEvent.click` が要る。happy-dom は矩形が0なので配置は実ブラウザで確かめる。zag の `keyboard()` に複数キーを渡さず1キーずつ送る
- UI を変えるので `pnpm test:smoke` を実行して受け入れ条件に含める
- テスト期待値の削除・緩和をするときは、その理由と、削除したテストの題名の行き先を報告に書く

## 11. 決定事項（理由つき）

1. 選択済み行はメニューと同じチェック列。メニューの規定（背景・太字を使わない）と揃えるため
2. QuickList の中身をモックの形に直す。12px の内側に旧パネル用の余白が二重になるため
3. AC4 は「ポップオーバーの外クリックで中のメニューごと閉じる」。§5
4. スクロールで閉じるを全ポップオーバーで統一。アンカーが隠れても層が残る状態を作らないため。サイドバーのホイールでの閉じ→開き直しの点滅を測る
5. アンカー外のボタンを押したらポップオーバーを閉じる。一般的な挙動で、例外（`persistentElements`）を増やさない
6. 「N件を追加」の後は▾。主ボタン経由・Esc と揃い、Footer と Tab の間に「移し先を返す」口を足さずに済む
7. 「＋絞り込み」は単一の層＋中身の切替。2層のクロスフェードを残すと、Esc で戻すために1段目の Root を開き直す配線と、層の切替での Ark の復帰が要るため
8. 1段目の初期フォーカスは1行目
9. ホバー層の戻り先は開く前の要素（§4 の 2 の連鎖の引き継ぎが前提）
10. 幅は現状維持（280/240/260/220）
11. タグのポップオーバーは Esc を常に TagCombobox に任せる
12. 音量ポップオーバーは content で stopPropagation。バーの `onKeyDown`（Enter・Space で展開など）の有無を確かめ、あれば同様に
13. トリガーの無い層は ids.trigger でアンカーをトリガー扱いにする。Tab/Shift+Tab は実ブラウザで測る

## 12. 実装の順序

1. `layer/` への切り出しと `useMotionMenu` の書き換え（メニューのテストが通ること）。先に ids.trigger の小さな確認（#1・#2・#7 で効くか）
2. `useMotionPopover`＋`PopoverPopup`＋スタイル、単体テスト
3. #8 音量（最小）→ #7 RegisterFields（MenuLayerItem 連携・確定）→ #5・6 タグ → #3・4 「＋絞り込み」→ #1・2 GroupValuePopover（行ごとの Root、coordinator の整理）
4. 旧フック・依存・CSS・テストの削除、docs（design-system.md と ADR-0043 の更新はこの段階で行う。§9）
5. 測定（§13）、smoke

## 13. 検証計画（実ブラウザと単体テスト）

各項目は繰り返して測り、`focusin`/`focusout` の記録と最終 `activeElement` を見る。body を経由しないこと、途中の余計な focus が無いことも見る。記録の取り方は TASK-529.2 の実装メモ。各箇所への到達手順は §14。本番の Ark は 5.40.0（試作の確認は 5.40.1）なので、試作で確かめた項目も本番の部品で測り直す。

### 想定と違ったときの既定の進み方

| 確かめる項目 | 想定と違ったとき |
|---|---|
| ids.trigger が #1・#2・#7 で効く（下の合否表） | 効かない観点だけ「persistentElements＋手動のフォールバック」に切り替える。報告に書く |
| 外側クリック時にホバー層の点滅（サイドバーのホイール後の開き直し） | §7 の抑止案（スクロール起因の close のときだけ「本物の pointermove を観測するまで開かない」フラグを倒す）を入れる |
| #2 で値を選んだ後にアンカーが作り直されて body に落ちる | 移動の直後に、パンくずの値へ明示的に `focus()` する |
| 音量ポップオーバーが、バーの退出（ポップアップへの切り替え）時に開いたまま残る | 開いている間は退出時に閉じる処理を足す。PlaybackRatePicker の同種の処理を参照して揃える |
| Tab/Shift+Tab でトリガーの無い層から抜けられない・戻れない | メニューと同じ「Tab は content の外へ出て閉じる」を受け入れ、報告に書く |
| 候補リストが content の外へはみ出したときの表示・外側判定がおかしい | 候補リストを content の内側に収める（overflow・max-height の調整）。外側判定は content 内の包含で見る |
| #6 の narrow 判定が開いたまま 320px をまたいで入力欄がアンマウントされる | 開く時点の判定を層が閉じるまで保持する（開く操作で `mode` を state に固定） |
| ホバー層を開いたまま ⌘K で検索欄へ移したとき、検索欄のフォーカスが奪い返される | `resolveReturnTarget` の 1（すでに移っていれば動かさない）が効いていないので、分岐の条件を見直す |

### ids.trigger の合否表（実装の最初に確かめる）

#1（サイドバーの行）・#2（パンくずの値）・#7（▾）それぞれで、3観点を各5回。

| 観点 | 操作 | 合格 |
|---|---|---|
| Tab の proxyTabFocus | 層を開いた状態で、トリガー（アンカー）にフォーカスを移して Tab / Shift+Tab（#7 は▾から。#1・#2 は ArrowRight またはクリックで開いたあと、検索欄から Shift+Tab）。#1・#2 は仮想化リストで最後の要素が DOM に無いことがあるので、「検索欄からの Shift+Tab でアンカーへ戻る」で判定する | Tab で層の中の最初の要素へ入る、層の最後の要素から Tab でアンカーの次へ戻る、Shift+Tab で逆向きに戻る。body に落ちない |
| アンカーの再クリック | 層を開いたまま、アンカー自身（行・パンくずの値・▾）をクリック | outside 扱いで即閉じて再び開く、ことにならない（クリックの処理が1回だけ走る）。#1・#2 は行・パンくずの本来のクリック動作（遷移・トグル）だけが起きる |
| トリガーへのフォールバック | 開く前の要素が無い状態（クリックで開いたあと body をクリックして閉じる／プログラムで開く）で閉じる | フォーカスがアンカー（トリガー）へ戻る |

代替（persistentElements＋手動のフォールバック）の中身: アンカー要素を `persistentElements`（`[() => anchorEl]`）に渡して、アンカーの再クリックを outside 扱いにしない。トリガーへのフォールバックは、`resolveReturnTarget` の 3 で、ids ではなくアンカー要素への参照（`useMotionPopover` の `anchorEl` オプション）を返す。Tab の proxyTabFocus はトリガーが無いと効かないので、その観点が不合格のときは「Tab で content の外へ出て閉じる」を受け入れる（メニューと同じ扱い）。一部の観点だけ不合格のときは、その観点だけ代替に切り替え、報告に書く（既定）。

### 測定項目

- 軸A→B（AC2）: ホバー→ホバー、ホバー→ArrowRight、50ms 間隔の往復を、「上→下」「下→上」に分けて各20回。A→B で最後が B の検索欄、A に戻らない、A の戻しが B の検索欄を奪わない、途中の余計な focus が無い。A を開いたまま B の行をすばやくクリックしても B が閉じない。本番の部品（5.40.0）で測る
- Esc の段（AC3）
  - #5 の WorkEditDialog のタグ追加を実ブラウザで測る（dialog＞ポップオーバー＞候補リスト）。候補を開いた状態で Esc→候補が閉じる、Esc→ポップオーバーが閉じる、Esc→dialog が閉じる。各10回
  - 「ポップオーバーの中のメニュー」の Esc の段（メニュー→ポップオーバー→dialog）は §5 のとおり client/tests/unit/ の常設テストで確かめる
- IME（AC3）: 下の手順。対象は #5 のタグ追加と GroupValuePopover の検索欄（#1 または #2）
- AC4: client/tests/unit/ の常設テスト（§5）。ポップオーバーの外をクリックして中のメニューごと閉じる
- 閉じ方ごとの戻し先（§4 の表）を各10回: Esc、外側クリック（フォーカスできる要素・できない領域）、確定、トリガー再押下、focus-outside
- RegisterFields: 「N件を追加」で body を経由しない（約50ms の解消）。Esc で ▾ へ1回で戻る。選択が空で SplitButton が消える場合は既存の focusRequest が受ける
- 音量ポップオーバーは、バーの退出（ポップアップへの切り替え）時に開いていたら閉じる
- #6 の narrow 切り替え: 開いている間は幅の判定を固定する（開いたまま 320px をまたいでも入力欄をアンマウントしない）。この固定は、実装でも `useElementWidth` の値を層が開いた時点で保持する形にする
- ホバー層を開いたまま ⌘K で検索欄へ移し、閉じて検索欄に残る
- サイドバーをホイールでスクロール→閉じた後に coordinator がポインター下の行を約200ms後に開き直して点滅しないか
- タグの候補リストが content の外へはみ出したときの表示と外側判定
- #2 で値を選んだ後にアンカーが作り直される件は、ids のトリガーで解決するか
- backdrop ガード: native dialog の中のポップオーバー（#5・#7）を開いたまま backdrop を押して、ポップオーバーだけ閉じる
- 見た目: §6 の数値と合っているか（下の「見た目の合格基準」）。リスト行が 28px（`ROW_ESTIMATE_SIZE` 29→28）になっていること

### 見た目の合格基準（定量）

測り方: 対象要素に対して `getComputedStyle` と `getBoundingClientRect` を取り、下の値と比べる（許容は±0.5px）。色は oklch のトークンを解決した値と、メニューの同じ要素（同じ画面で開いたメニューの content・項目）の computed 値が一致すること。

全箇所の content（`[data-scope="popover"][data-part="content"]`）:
- background-color: `--paper-1`、border: 1px solid `--line-soft`、border-radius: 6px、box-shadow: `--shadow-pop`、padding: 12px（#8 音量は内容に合わせて 12px）、font-size: 12px、z-index: 50（positioner の z-index も 50）
- アンカーの矩形と content の矩形の間隔: 6px（placement の向きの辺）
- 出入り: opacity と transform: scale の transition/animation が 0.12s、scale は .96→1

箇所ごとの幅と配置:

| # | content の幅 | placement | transform-origin（`menuScale` の origin。MenuPopup の origin と同じ対応） |
|---|---|---|---|
| 1 | 280px | right-start | left top |
| 2 | 240px | bottom-start | top left |
| 3・4 | 240px | bottom-start | top left |
| 5・6 | 260px | bottom-start | top left |
| 7 | 220px | top-end | bottom right |
| 8 | 内容幅 | top | bottom center |

origin の対応の原則: placement の向きの反対側の辺・角を起点にする（bottom-start→top left、top-end→bottom right、right-start→left top、top→bottom center。メニューの above→bottom right、belowEnd→top right と同じ考え方）。

QuickList（#1・#2・#4）:
- 検索欄: height 28px、padding 0 8px、border 1px solid `--line`、border-radius 4px、background `--paper-0`、color `--ink-0`。下線は無い
- 項目（`.mll-qlist__item` 相当）: height 28px、padding-left/right 8px（入れ子の字下げ分を除く）、border-radius 4px、gap 8px。ホバーとキーボードのハイライト: background `--paper-2`、color `--ink-0`
- 選択済みの値: 左に 14×14px のチェック列、チェックの色 `--acc`、背景と font-weight の変更なし（400 のまま）
- 件数: font-family 等幅、font-size 11px、color `--ink-3`、padding-left 16px
- 仮想化リストの行の見積もり（`ROW_ESTIMATE_SIZE`）28px。リストの総高さが、項目数×28＋行間の gap に一致する

メニューとの並び: 同じ画面で、メニュー（SplitButton の▾など）とポップオーバーを順に開き、外枠の computed 値（border・radius・shadow）が一致すること。

## 14. 各箇所への到達手順

共通: worktree のルートで `pnpm dev:fixture:new-work` を起動し、`http://task-529.2-ark-popover.mimi.localhost:1355` を開く（シナリオ new-work）。検証の前に `POST /api/__test__/reset` を呼んで状態を戻す。

| # | 手順 | 必要な状態 |
|---|---|---|
| 1 | ライブラリ画面のサイドバーで、グループ分けを持つスマートフォルダーの行（行の右に › が出る行）にポインターを約200ms置く。または行にフォーカスして ArrowRight | サイドバーの編集モードでないこと。グループ分けを持つ行が2つ以上あること（軸A→B の測定に必要。既定のスマートフォルダーに「CV別」「サークル別」「カテゴリ別」「タグ別」「追加年別」などのグループ分けを持つ行がある想定（shared/src/smartFolderTemplates.ts の `grouped(...)`。`seeded: false` の「レーティング別」は初期には出ない）。開いて確かめ、2つ未満なら、サイドバー上部の＋メニューの「グループ分けを追加」またはテンプレートから追加する） |
| 2 | スマートフォルダーの値（グループ分けの値）を選んで作品一覧を開き、上部のパンくずの末尾の値をクリック | 値一覧から値を選んで作品一覧（works ビュー）にいること |
| 3・4 | 作品一覧のチップ列（タグバンド）の「＋絞り込み」をクリック。1段目でグループ分けを選ぶと 2段目 | 作品一覧にいること |
| 5 | 作品を選び、詳細ペインの「作品を編集」を押して編集 dialog を開き、タグ欄の「タグを追加」をクリック | 作品が1件以上あること |
| 6 | 作品を選び、詳細ペイン（編集モードでない通常表示）の「タグを追加」をクリック。narrow は、詳細ペインの実幅（`.mle-prv__meta` の `clientWidth`）が 320px 未満になるようビューポートを狭める（`clientWidth` を開発ツールで読んで確認する。ペインの幅を変えられる操作があれば使ってよい） | 作品が選択されていること。narrow の確認では、開いたまま幅を変えて 320px をまたぐ操作も行う（開く前と開いた後の両方） |
| 7 | 「スキャン」を開き（ヘッダーの「スキャン」ボタン）、dialog の「スキャン」を押し、「未登録（N）」タブで行を1つ以上選ぶ。フッターに SplitButton（「N件を追加」または「DLsiteから取得 N件」と▾）が出る。▾を開いて「項目を選んで追加…」を選ぶと RegisterFieldsPopover が開く | 未登録タブで行が選択されていて、追加できる状態（取得中でない・RJコード保存中でない）。「DLsiteから取得」が主ボタンのときは、先に取得するか、メニューの「取得せずに追加」を使う |
| 8 | 下部の再生バー（作品を再生すると出る）の音量ボタンをクリック | 作品を再生中であること。詳細ペインの再生ボタンで再生する |

## 15. IME の合成確認

対象: #5 のタグ追加（TagCombobox の入力欄）と GroupValuePopover の検索欄（#1 または #2）。実機の IME ではなく、CDP の合成であることを報告に明記する。

1. 層を開き、入力欄にフォーカスがある状態にする
2. `Input.imeSetComposition`（text に「あ」など、selectionStart/End を設定）で変換中にする
3. `Input.dispatchKeyEvent`（type: "keyDown"）で、`key: "Process"`、`windowsVirtualKeyCode: 229`（keyCode 229）の keydown を、Esc と Enter の代わりにそれぞれ送る（isComposing は true になる）。実機の Windows の IME は、変換中の Esc・Enter をこの形で送る
4. 期待: 層が閉じない、タグが確定しない（#5 の Enter）、値の項目が実行されない（#1・#2 で Enter）。変換を確定した後の通常の Esc で閉じる
5. 参考: `key: "Escape"` と `isComposing` を合成する確認は、実機より厳しい条件になることがある。結果が分かれたら、Process/229 の形を優先して報告する
