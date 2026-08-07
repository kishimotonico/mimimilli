# デザインシステム規約

レイアウト・機能仕様の正は実装（`client/src/`）。本書は実装からは読み取れない設計意図・規約だけを記す。出典の詳細モックは Git 履歴の `docs/design_handoff_mimimilli_library/`（2026-07-03 削除）にある。

## カラートークンの意味づけ

トークン定義の正は `client/src/styles/tokens.css`（oklch）。用途は以下の通り。

- `--paper-0〜4`: 背景・面。0=ページ床、1=カード等の浮いた面、2=hover、3=pressed/行の縞、4=selected
- `--line` / `--line-soft` / `--line-strong`: 罫線。強調度の3段階
- `--ink-0〜4`: 文字色。0=本文、1=セカンダリ、2=キャプション、3=プレースホルダー、4=ごく薄い
- `--acc` 系: アクセント（既定は柿色）。soft=淡色背景、line=枠線、ink=アクセント上の文字
- riso 系（`--r-coral` / `-leaf` / `-mustard` / `-plum`）: カバーアートやマルチchミキサーの色分け用。リソグラフ風の彩度
- タグカテゴリ色（`--cv-color` / `--circle-color` / `--series-color` / `--cat-color`）: 構造化タグ（`cv/` `サークル/` `シリーズ/` `カテゴリ/`）を視覚的に区別する専用色。フラットタグには使わない
- `--shadow-cover`: カバーアート専用の影（内側ハイライト付き）。通常の面には `--shadow-1/2/pop` を使う

## テーマとアクセント

ダークテーマは未実装（`.ml-dark` のトークン先行定義も撤去済み）。将来対応する場合はトークンから設計し直す。アクセント色は `.ml-acc-coral` / `.ml-acc-grass` / `.ml-acc-cobalt` の差し替えクラスだけで全体に伝播する。

モックのみに存在した `.ml-acc-graph` は実装未移植。必要になった場合は Git 履歴の削除前ディレクトリを参照する。

## タイポグラフィ

- `IBM Plex Sans JP`: 本文の既定書体
- `Geist`（sans）: ブランド表記・操作系コントロールなど非本文
- `JetBrains Mono`: 時刻・件数・メタ情報などの数値表示

## クラス命名

- `mle-`: Explorer / 共通シェル系（フレーム・カラム・アドレスバー・行など File/Library 共通の骨格）
- `mll-`: Library モード固有（軸レール・作品行・リッチ詳細・スマートルールなど）
- 状態は `is-` プレフィックス: 選択 = `.is-on`（paper-4 背景）、選択+フォーカス = `.is-on.is-focused`（黒地白文字に反転）。行・軸系コンポーネントを追加するときはこのパターンを踏襲する

`shell.css` は全規則がカスケードレイヤー内にある。UA要素のリセット（`button` / `input` / `a` / `ul` / `ol` 等）は `@layer base`、`mle-`/`mll-` のコンポーネント規則は `@layer components` に置く。Tailwind v4 のレイヤー順（`theme, base, components, utilities`）により、`@layer utilities`（Tailwindユーティリティ）が `components` より強く効くため、tsx側で `mle-`/`mll-` クラスと Tailwind ユーティリティを併用すると、ユーティリティ側で局所的に上書きできる。レイヤー外に素のセレクタを書くと、レイヤーの規則（unlayered が常に layered に勝つ）で utilities を問答無用で潰してしまうため、セレクタを足すときは必ずどちらかのレイヤー内に置く。

フォント指定とUA要素のリセット（`@layer base` の `button` / `input` / `a` / `ul` / `ol`）は `body` セレクタでスコープする（`.mle-app` ではない）。アプリの DOM は `body` 直下に `#root`（= `.mle-app`）と、`createPortal(..., document.body)` で出すポータル要素しかないため、`body` にスコープしておけば新しくポータルを追加しても個別に打ち消しCSSを書く必要がない。ポータルを新規に追加するときはこの前提を壊さないこと（ラッパー要素にあえて別のフォント・リセットを指定したい場合を除き、何もしなくてよい）。

## Overlay / z-index の現在の階層

実装調査済みの値（正は実装）。

| 要素                                                                  | 層                    |
| --------------------------------------------------------------------- | --------------------- |
| 並び替えメニューのポップアップ                                        | z-index 30            |
| 軸のクイックオーバーレイ・チップの値ドロップダウン（`.mll-qoverlay`） | z-index 30            |
| プレイヤー（バー/ポップアップ）                                       | z-index 32            |
| 設定モーダル                                                          | top layer（下記）     |
| 全画面プレイヤー                                                      | top layer（下記）     |
| スキャンモーダル                                                      | top layer（下記）     |
| スマートフォルダーエディタ                                            | top layer（下記）     |
| 作品編集・DLsite適用プレビュー                                        | top layer（下記）     |
| **グローバルトースト**（`Toast` / `GlobalToast`）                     | **top layer（下記）** |

設定モーダル・全画面プレイヤー・スキャンモーダル・スマートフォルダーエディタ・作品編集・DLsite適用プレビューは
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
モーダルより上に出せない制約を避ける。トースト表示中も背面のモーダル操作は
ブロックしない（popover は dialog のようなモーダルフォーカストラップを持たない）。
top layer 内の前後関係は表示タイミングの新しい方が手前になるため、モーダル表示後に
トーストを出せば常に最前面に見える。

## ライブラリ: チップ列・値一覧行・オーバーレイ

方針の正は [ADR-0012](adr/0012-library-axis-as-value-browse.md)。実装からは読み取りにくい規約だけをここに記す。

チップ列（`.mll-tagband`、`FilterChipBand`）は選択フィルタが0件でも常に表示し、末尾の「＋絞り込み」から最初の1件を追加できる。チップの表示文字列は軸を問わず常にフルパス（`buildFilterTag` の出力そのもの）で、省略や軸名の非表示は行わない。

値の選択操作（軸レールのクイックオーバーレイ・チップの兄弟値ドロップダウン・「＋絞り込み」・値一覧の行/タイル）は、`ValueSelectionIntent`（`client/src/features/library/model/valueSelectionContract.ts`）という単一の契約で表現する。各入口は「既定＝置き換え」「既定＝AND追加」のどちらかだけを宣言し、主クリックの意味・`Ctrl`/`Cmd`+クリックの反転先・追加ボタンの有無は `deriveValueSelectionHandlers` が一意に導出する。既定＝AND追加の入口では戻り値に追加ボタン用ハンドラが存在しないため、「AND追加が既定なのに追加ボタンあり」のような組み合わせは型で表現できない。置き換えは結果面を作品一覧へ進め、AND追加は現在の結果面に留まる（置き換え＝「見たいものが変わった」、AND追加＝「絞り込みを積んでいる途中」）。

背後の action atom は3つある。`replaceLibraryTagAtom`（置き換え）、`toggleLibraryTagAtom`（`Ctrl`/`Cmd`+クリックによる反転先。選択済みなら解除する）、`addLibraryTagAtom`（追加ボタン・既定＝AND追加の主クリック用。冪等で、選択済みなら何もしない）。追加ボタンは常に `addLibraryTagAtom` を呼ぶため選択済みタグを解除せず、選択済みの行には追加ボタン自体を表示しない。コンポーネント側でこれらの action atom を直接分岐させず、必ず `ValueSelectionIntent` を宣言して `deriveValueSelectionHandlers` を経由する。

値行（`AxisValueQuickList`・`AxisValueRows`・`AxisValueGrid`）は `role="listbox"` / `role="option"` を使わない。行は主選択ボタンとAND追加ボタンという2つのフォーカス可能要素を内包しており、ARIAのoption roleが想定するテキスト相当の内容とは合わないため、listboxパターン自体を採らない。行のコンテナは無地の `div`（仮想化の絶対配置ラッパーと責務が重なるため `ul`/`li` は使わない）で、選択状態は実際にフォーカスされる主選択ボタン自身の `aria-pressed` で表す（`WorkTile` の単一ボタンタイルと同じ表現）。矢印キーでの行移動は `data-index` / `data-quicklist-item` を目印にした自前のフォーカス制御で行い、ARIAのlistbox/optionキーボード規約には従わない。行をまとめるスクロールコンテナ（`.mll-qlist__body` / `.mle-col__list` / `.mll-grid-scroll`）には `role="group"` と `aria-label="{軸名}の値一覧"` を付け、複数のフォーカス可能要素を子に持てる集合として名前だけは伝える。軸名は各コンポーネントが `axis`（ID）から自前で `getAxisLabel(axis)` を呼ばず、呼び出し元が `getAxisLabel(axis, tagPrefixes)` で解決した表示ラベルを `axisLabel` propとして受け取る（tagPrefixesを渡さないと未登録prefixでIDがそのまま支援技術に通知されるため）。軸レールのトリガーボタン（`AxisColumn`）は開くパネルが `menu`/`listbox` いずれのパターンでもないため `aria-haspopup` を持たず、開閉状態は `aria-expanded` のみで表す（disclosureパターン）。

入れ子タグ（スラッシュ複数）の階層表示は名前順ソートのときだけ有効で、件数・総時間ソートではフルパスの平坦表示にフォールバックする（`axisValueHierarchy.ts`）。中間ノードは実際にタグとして存在する場合だけ選択可能な値行（配下の見出しを兼ねる）になり、存在しない場合は選択不可の見出し行になる。「配下を含む絞り込み」は作らない（ADR-0005 §6 の完全一致セマンティクスと衝突するため）。グリッド表示ではタイルの正方形の都合上インデントは付けず、代わりに葉ラベルの上に親パスを小さく添える。

軸レールのクイックオーバーレイは軸カラム（`overflow: hidden auto`）の外にはみ出すため `document.body` へポータルする。チップの値ドロップダウン・「＋絞り込み」はクリップされない領域にあるため非ポータルの絶対配置で済ませる。両者とも横方向のクランプは `useAnchoredPopover` の `getContainer` オプションで対象コンテナを差し替える。複数のトリガーが1つのポータル越しパネルを共有し常に高々1つだけ開くホバーUI（軸レールのクイックオーバーレイ等）は `useHoverGroupCoordinator`（`shared/lib/`）を使う。開閉タイマーの共有に加え、トリガーからパネルへの斜め移動が他のトリガー行の上を通過してもセーフトライアングル判定で開閉が横取りされない。

## Motion / cursor

方針の正は [ADR-0014](adr/0014-motion-reintroduction-presence-removal.md)。実装からは読み取りにくい規約だけをここに記す。

- 構造的なモーション（要素の出入り・スライド等）は `motion`（`motion/react`）の `AnimatePresence` で実装する。マウント境界は `{open && <Child />}` の条件レンダーにし、duration・easing・delay は `client/src/shared/ui/useMotionVariants.ts` の variant ビルダーに集約する。**`transition.delay` の直書きは禁止**（reduced-motion 時の 0 化を迂回するため）。delay が要る場合はビルダーのオプション経由にする
- 汎用ラッパーコンポーネントは作らない。共有するのはトークン（variant ビルダー）と規約のみで、各所で motion コンポーネントを直接使う
- 既存ルート要素は直接 `motion.div` 等に置き換える（ラッパー DOM を被せない）。ただし collapse でルート要素に padding/border がある場合は、`overflow: hidden` だけを持つ無地のラッパーを 1 枚だけ被せる
- `layout` / `layoutId` は使わない（過去にカバー歪みで撤去済み）。スコープは出退場・opacity・transform・width・height(0↔auto) に限定する
- fade の退出 `position: absolute` は最も近い positioned ancestor を基準にする。fade を使う箇所ごとに祖先が positioned かを確認する
- AP 境界の子は必ずコンポーネントとして切り出し、内部で `useIsPresent()` を呼ぶ。用途は (a) ルート要素への `inert={!isPresent}`、(b) document/window レベルのリスナー（outside click・Escape 等）の退出中解除、の 2 つに限定する。**フォーカス復帰には使わない**
- クエリ購読は開閉状態に連動させない（`useXxxQuery(isOpen ? a : null)` のような引数の null 切替をしない）。子がマウントされている間は常に有効な引数で購読する
- `MotionConfig reducedMotion="user"` は transform/layout のみ抑止し、opacity アニメは止まらない。`useMotionVariants` が reduce 時に全 variant の duration/delay を 0 にすることで opacity アニメも実質即完了させる
- hover は短い transition のみで十分。派手な演出は避ける
- 操作不能な要素は `cursor: not-allowed` にする
- 長時間ループするアニメーション（パルス等）は reduced motion 対応を原則とする

## テキスト選択

UI 全体は `shell.css` の `@layer base` で `body { user-select: none }` を既定とする（初回セットアップ画面・`document.body` へポータルするダイアログも含む）。`input` / `textarea` / `select` は同レイヤーで `user-select: text` を明示し、入力・IME・フィールド内選択を維持する。

コピー需要のあるテキスト（物理パス、RJコード、エラーメッセージ、CLI 例文、ルートフォルダーパス、作品情報ダイアログ本文など）は `.mll-selectable` を付与するか、既存のパス・警告・エラー用クラス（`.mle-prv__warn-path` / `.mle-fprev__path` 等、`shell.css` の `@layer components`）で `user-select: text` に戻す。一覧・グリッド・ファイル行のラベルは操作と競合するため選択可能に戻さない。

## アイコン

アイコンは `client/src/shared/ui/Icon.tsx` の `I` レジストリに集約する。呼び出し側は必ず `I.xxx` 経由で参照し、`lucide-react` を直接importしない。ライブラリ選定の経緯は [ADR-0009](adr/0009-icon-library-lucide.md)。

- 一般的な意匠で足りるアイコンは `lucide-react` から取得して `I` に登録する。製品固有の意匠（`ratio11`・`gridJustified`・`loopOne`・`swapLR`・プレイヤー系の塗り表現など、一般カタログに対応がないもの）は自作を維持し、同じ `I` に追加する
- stroke幅（1.5）・`currentColor`・`aria-hidden="true"` はアダプタ層（`Icon.tsx`）で固定する。呼び出し側やベンダー固有propsをこれらの値に触れさせない
- サイズは `IconButton` のサイズ契約（`sm`/`md`/`lg` = 箱26/30/38px、アイコン14/16/20px）に従う。呼び出し側で独自の数値を散らさない
- SVGは装飾（`aria-hidden`）とし、意味は `IconButton` 側の `aria-label` が担う。名前を持たないアイコン単体での使用を避ける

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
