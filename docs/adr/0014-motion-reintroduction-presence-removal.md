# ADR-0014: motionを再導入し自前Presence基盤を廃止する

- ステータス: 承認
- 日付: 2026-08-08
- 関連: backlog TASK-238〜245（実装8フェーズ）、TASK-156（覆される決定）、TASK-237（手動値退避の導入元）、TASK-429（原則6・useIsPresentの用途をさらに拡張）、[design-system.md](../design-system.md)

## 文脈

TASK-156（2026-07-31, コミット 10c28bd）で、motion系3パッケージ（motion-dom + framer-motion + motion-utils）を削除し、自前の `usePresence`/`Presence`（`client/src/shared/ui/`）+ CSSトランジションへ置き換えた。motion系がバンドルの推定22%を占める一方、用途は6ファイルの出現・退出アニメのみだったためで、削除の実測効果は gzip 211KB→169KB（-42KB）。当時の優先順位（バンドルサイズ重視）では正しい判断だった。

その後、次の問題と状況変化が生じた。

- 自前Presenceは「同一コンポーネントをマウントしたまま `show=false` で退出フェーズに入れる」方式のため、退出中も子のhooksが最新のprops/atom/query値で再実行され、表示データがnull化する。これを回避する手動値退避（`value ?? lastRef.current` 型）がTASK-237で4ファイル・5refに蓄積した
- この手動退避は一般的なパターンではない。motion の `AnimatePresence` は条件レンダーから消えた子を「最後にレンダーされたReact要素」として凍結レンダーするため、データがpropsとして境界を越えていれば退避は不要になる
- CSS durationとJSタイマーの二重管理（`presenceDurations.ts` ↔ `shell.css`）、PlayerDockの `onExitComplete` + `transition-delay` 連携など、基盤自体の脆さも確認された
- ユーザーが優先順位を明示的に変更した:「バンドルサイズ削減の要望はない。アーキテクチャとソフトウェアの健全性・クリーンさを優先する。今後、手触りを良くするフェーズでアニメーションを高品質に実装できる必要がある」

本決定に先立ち、Cursorサブエージェントによるコードベース調査、motion公式ドキュメント（motion.dev）による仕様確認、Codexによる敵対的レビュー4巡（v1→v4）を実施し、最終判定「実装へ進める水準」を得た。

## 決定

motion を再導入し、出現・退出アニメーションの基盤を `AnimatePresence` に統一する。自前の `usePresence`・`Presence`・`presenceDurations.ts` と `shell.css` のPresence系トランジションは全廃する。TASK-156の判断は当時としては正しかったが、優先順位の変更により覆す。

実装はTASK-238〜245の8フェーズで行う。各フェーズの受け入れ条件はタスク側が正。以下は設計原則と確定事項。

### 移行の原則

1. **Presenceの置換だけでは退避は消えない**。マウント境界を `{open && <Child />}` の条件レンダーへ移し、`AnimatePresence` で包む。手動値退避ref（`AxisQuickOverlay.lastResultRef` / `AxisValuePopoverPanel.lastResultRef` / `FilterChipAddButton.lastPickedAxisRef` / `AxisColumn.lastOverlayAxisRef` / `AxisColumn.lastAnchorElRef`）の削除を受け入れ条件とする
2. **クエリ購読は条件境界の内側に置き、開閉状態に連動させない**。`useAxisFacetsQuery(isOpen ? axis : null)` のように引数のnull切替でquery keyを変えるパターンが退避の直接原因（このフックに `enabled` オプションは無い）。子がマウントされている間は常に有効な引数で購読する
3. **AP境界の子は必ずコンポーネントとして切り出し、内部で `useIsPresent()` を呼ぶ**。用途は (a) ルート要素への `inert={!isPresent}`、(b) document/windowレベルのリスナー（outside click / Escape / pointermove 等）の退出中解除、の2つに**限定**する。**フォーカス復帰には使わない**（軸A→B切替時に旧Aが新Bからフォーカスを奪うため。復帰は現行どおり activeElement を検査して reason を渡す close ハンドラ側の責務のまま）※用途はTASK-240で3つ、TASK-429で4つへ拡張（下記「実装時に判明した訂正」参照）
4. **variantトークンモジュール**（`presenceDurations.ts` の後継、`useMotionVariants()` フック + booleanを受けるbuilderのペア）に duration・easing・delay・transform-origin を集約する。プロパティ別duration・enter/exitの非対称scale・overshoot easing（cubic-bezier(0.34,1.2,0.64,1)）を表現できる形式にする。**delayを含む全パラメータをbuilder経由にし、コンポーネント側の `transition.delay` 直書きは禁止**（reduced-motion時の0化を迂回するため）
5. **汎用ラッパーコンポーネントは作らない**。TASK-156でAnimatePresence相当（TransitionPresence）の自作がレビュー5巡で破綻した教訓。共有するのはトークンと原則3の規約のみで、各所で motion コンポーネントを直接使う
6. **既存ルート要素を直接 `motion.div` 等に置き換える**（ラッパーDOMを被せない）。`position: fixed` オーバーレイの座標系・stacking context破壊を防ぐ
7. **`layout` / `layoutId` は再導入しない**。過去にカバー歪み等で撤去済み（docs/issues/2026-07-02-player-ui-redesign.md）。スコープは出退場・opacity・transform・width・height(0↔auto) に限定

### 個別の確定事項

- **collapse**: motionが公式サポートする `height: 0 ↔ "auto"` + opacity + ルート `overflow:hidden` を使う。現行のgrid `0fr↔1fr` トリックは「CSSがheight:autoを扱えない」ことへの回避策であり廃止（gridTemplateRowsの直接アニメは公式ドキュメントに明記がなく不採用）。内側の子レイアウト（flex/flex-direction/gap）はCSS削除で失わない。対象3箇所（ScanModal警告・新規作品、AxisValueQuickListソートメニュー）はいずれもルートにpadding/borderが無くこの方式で成立することを確認済み
- **ScanModal**: 単一スロット化はStatusRowの排他3状態のみ、方式は sync + 退出absolute（`mode="wait"` は現行の並置クロスフェードとタイミングが変わるため不使用）。警告・新規作品・フッターは同時表示の組み合わせがあるため独立AP境界のまま
- **PlayerDock**: 現行どおり旧・新を並存させ入場側だけ180ms遅延（delayはbuilder経由）。`onExitComplete` で `switchingUiMode` 解除。rapid toggle・`onExitComplete` 一回保証は spy + fake timers の統合テストへ移管
- **Toast**: `message=null` で即 `hidePopover()` する現行実装では退出が見えないため、`onExitComplete` まで遅延。文言差し替えは単一スロット契約（即時反映）を維持し `key={message}` 並存はさせない。**表示世代トークンの照合は行わない**（TASK-239の実装時に不要と判明。理由は下記）
- **軸切替の並存**: `useHoverGroupCoordinator` をインスタンストークン付きの所有権APIへ変更する。パネルref・`panelHandlers`・coordinator所有の document `pointermove` は現在openなownerのみに紐づけ、解除時はトークン一致を確認する
- **reduced-motion**: `MotionConfig reducedMotion="user"` はtransform/layoutのみ抑止し**opacityアニメは止まらない**（motion.dev公式ドキュメントで確認）。よって `useMotionVariants` がreduce時に全variantの duration/delay を0にする。完了通知は「flush後に一度発火」と定義し（同一render内の同期発火は保証しない）、fake timers + spy でテストする。`matchMedia` スタブ（change listener API含む）を `tests/unit/setup.ts` に追加する
- **`initial={false}`**: 現行 `skipInitial` は計13箇所（TopBar 1 / FilesView 1 / PlayerDock 2 / ScanModal 9）。フェーズ1で対応表を作成し各フェーズで消化する
- **fade**: 退出要素の `position:absolute` によるレイアウト膨張防止を再現する（フェーズ1で方式確定、TopBarで実証）
- **CSS削除**: セレクタ単位の削除リストで行う。`.mle-colstack__edges`・`.ml-file-col-enter`・装飾系keyframes（barwave/EQ/skeleton等）とそれらのreduced-motion指定は維持
- **バンドル計測**: `pnpm --filter @mimimilli/client build` で移行前後を実測し、全JS合計と初期チャンク（gzip）を分けて本ADRへ追記する（TASK-245）

### 検証方針

- ユニット/統合テストでタイマー・状態遷移・spy回数を検証。smokeテストはCSSアニメのみ0化しmotionのWAAPI/JSアニメは止まらない点に留意し、状態遷移の正しさを見る
- モーションの体感確認はユーザーがdev serverで行う。各フェーズ完了時に動作する状態を保つ

## 帰結

- バンドルは増加した。当初の予測は「TASK-156削除時の実測（gzip 211KB→169KB、-42KB）の逆方向」だったが、実測はこれを上回った。**motion@13 の tree-shaking が当時（framer-motion系）より改善しているという仮説は成り立たなかった**。健全性・手触りを優先する判断自体は変わらないが、実際のコストは予測より大きかった
  - 移行前ベースライン（55f9206、motion/clsx/tailwind-merge いずれも未導入）: 全JS合計 189.03 kB gzip / 初期チャンク 176.05 kB gzip
  - 移行後の最終実測（TASK-244完了後、`pnpm --filter @mimimilli/client build`）: 全JS合計 241.16 kB gzip（+52.13 kB, +27.6%） / 初期チャンク 227.70 kB gzip（+51.65 kB, +29.3%）。内訳は index（エントリ）227.70 kB、FilesView（遅延）6.40 kB、ScanModal（遅延）4.06 kB、SettingsModal（遅延）3.00 kB
  - 増加分のうち clsx + tailwind-merge（TASK-246）由来は +9.53 kB（全JS合計・初期チャンクとも同額）で、motionの増分ではない。残り（全JS合計 +42.60 kB / 初期チャンク +42.12 kB）が motion 自体のフットプリント
- 自前Presenceとmotionの混在期間はフェーズ2〜7を連続実施して短く保った
- `presence.test.tsx` は廃止され、検証はPlayerDock統合テスト等へ移管された
- `docs/design-system.md` のMotion節はTASK-245で新基盤前提（MotionConfig / AP / 原則3 / layout禁止 / reduced-motion仕様）に書き換え済み
- 手動値退避パターン（TASK-237で導入）は根絶され、以後「クエリ購読を開閉stateに連動させない」が規約になった

## 実装時に判明した訂正

### Toastの表示世代トークンは不要（TASK-239）

当初「表示世代トークンを照合し、退出中に再表示された新Toastを古いコールバックが隠さない」と決めていたが、実装時にこのガードが到達不能であることが判明したため撤回した。

`AnimatePresence` は子の識別に `getChildKey = (child) => child.key || ""` を使う（framer-motion 13.0.0 の `AnimatePresence/utils.mjs`）。単一スロット契約により子へ `key` を付けないため、連続する全Toastが同一キー `""` を共有する。この状態で「A表示 → null → B表示」が退出完了前に起きると、`AnimatePresence` は同一キーの再出現とみなして**Aの退出を取り消し同じスロットをBへ差し替える**。この経路では子が `exitingChildren` に積まれず `onExitComplete` が一度も発火しないため、「古いコールバックが新Toastを隠す」事故は構造的に発生しない。

よって世代トークンは発火しないコールバックを守る死んだコードであり、「過度なフォールバック禁止」に照らして置かない。退出中の再表示時の見た目は「Aが退出アニメ途中でBの文言に差し替わり animate 状態へ戻る」中断クロスフェードになる。これは単一スロット契約（文言差し替えは即時反映）の帰結として受け入れる。

### fade退出のabsoluteは祖先のpositionを要求する（TASK-239）

`fade()` の `exitAbsolute`（既定true）が生成する `position:absolute; top:0; left:0; right:0` は、最も近い positioned ancestor を基準にする。旧CSSの `.ml-presence-fade[data-phase="exit"]`（`position:absolute; top:0; left:0; width:100%`）も同じ性質を持ちながら祖先の position を保証しておらず、`.mle-app` を含む祖先がいずれも static だったため viewport 基準になっていた。TopBarでは `.mll-bar` がページ最上段かつ全幅なので視覚的に一致し、問題が顕在化していなかった。

TASK-239 で `.mll-bar` に `position: relative` を追加して修正した（z-index未指定のため新しい stacking context は生成されない）。**fade を使う各箇所で祖先が positioned かを個別に確認すること**。

### document pointermove はトークン照合ではなく動的参照で所有権を守る（TASK-240）

「軸切替の並存」で「パネルref・`panelHandlers`・coordinator所有の document `pointermove` は現在openなownerのみに紐づけ、解除時はトークン一致を確認する」と決めていたが、実装では前二者のみトークン照合を行い、document `pointermove` はトークンを持たない。

`useHoverGroupCoordinator` は `OpenState { key, anchorEl, token }` を単一のstateとして保持し、`commitOpen` のたびに `Symbol(key)` で新トークンを発行する。`registerPanelEl(token, el)` と `getPanelHandlers(token)` はトークン不一致の呼び出しを無視するため、退出中の旧ownerが遅れて解除を呼んでも新ownerの登録を壊さない。

一方 `engageTriangleGuard` / `onDocumentPointerMove` / `resolveAfterGuard` は `openStateRef.current` を都度動的に参照する。coordinatorのモデル上 openState は常に高々1つなので、古いクロージャが古い状態に作用する余地がそもそも無い。トークン照合は「古い参照を掴んだままの呼び出しを弾く」ための仕組みであり、参照を掴まない設計ではより強い保証になる。よってトークンを追加しない。

この前提は「openStateが単一」に依存する。coordinatorを複数インスタンス化する変更を入れる場合は、document `pointermove` 側にもトークン照合が必要になる。

### collapse対象の1箇所はルートにpadding/borderがあった（TASK-243）

collapseの確定事項に「対象3箇所（ScanModal警告・新規作品、AxisValueQuickListソートメニュー）はいずれもルートにpadding/borderが無くこの方式で成立することを確認済み」と書いたが、**AxisValueQuickListのソートメニューについては誤り**だった。`.mll-qlist__sort` は `padding: 4px 8px` と `border-bottom: 1px solid var(--line-soft)` を持つ（`shell.css:1615-1620`）。

`height: 0` へ縮めても padding と border は残り、閉じた状態で見切れる。このためTASK-243では `.mll-qlist__sort` 自体をAP境界のルートにせず、`overflow: hidden` だけを持つ無地の `motion.div` を1枚外側に置き、`.mll-qlist__sort` をその子として維持した。閉じたとき外側が子ごとクリップするため padding/border が残らない。

これは原則6（既存ルート要素を直接motion化しラッパーDOMを被せない）の例外だが、次の理由で許容する。原則6の趣旨は `position: fixed` オーバーレイの座標系・stacking context破壊の防止であり、in-flowのcollapseには当てはまらない。また旧実装は `.ml-presence-collapse`（無地）→ `.ml-presence-collapse__inner`（flex/gap）→ `.mll-qlist__sort` の2段ラッパー構造で、新実装は1段なので**ラッパーは純減**している。

規約としては次のとおり。**collapseを適用する際はルート要素の padding/border を必ず確認する。無ければルート自身をmotion化し、あれば `overflow: hidden` だけを持つ無地のラッパーを1枚だけ被せる。**

### useIsPresent の用途に「再オープン時の初期フォーカス」を追加（TASK-240）

原則3は `useIsPresent()` の用途を (a) `inert` (b) リスナー解除の2つに限定し「フォーカス復帰には使わない」と定めたが、実装では3つ目の用途が生じた。`AxisValuePopoverPanel` が `isOpen={isPresent}` を `AxisValueQuickList` へ渡し、退出アニメ中に同じ軸が開き直されたとき（Escapeで閉じてすぐ同じ軸を開く等）に検索欄へフォーカスし直すのに使っている。

原則3が禁じたかったのは**閉じたときのフォーカス復帰**であり、これは「軸A→B切替時に旧Aが新Bからフォーカスを奪う」ことを防ぐための制約だった。再オープン時に自分の入力欄へフォーカスを入れる用途はこの失敗モードを起こさない（フォーカスを入れる先が、いま開いている要素自身のため）。実際、軸A→B高速切替のrapid reopenテストで新パネルの検索欄フォーカスが維持されることを確認している。

よって用途を3つに拡張し、禁止事項を「閉じたときのフォーカス復帰に使わない」へ精密化した。復帰は `activeElement` を検査して reason を渡す close ハンドラ側の責務のまま。

### 省略メニューのラッパーは、幅アニメーション対象とoverflow:hiddenの影響を受けない配置基準を分離するための例外（TASK-429）

ファイルモードの折り畳み帯（`AncestorStack`）で、表示上限（3枚）を超えた祖先を1枚に畳む省略スロット（`EllipsisSpine`）は、幅アニメーション対象の `motion.div`（`.mle-colstack`、`overflow: hidden`）をAnimatePresenceの直接の子にせず、無地のプレーンdiv（`.mle-colstack-anchor`）でくるみ、その中に `motion.div` と一覧メニュー（`role="menu"`）を兄弟として置いている。これも原則6（既存ルート要素を直接motion化し、ラッパーDOMを被せない）の例外である。

理由はTASK-243（collapse対象のpadding/border）とは異なる。一覧メニューの幅（160px）は `.mle-colstack` の幅（46px）を超えて描画される必要があるが、`.mle-colstack` はwidthアニメーションのために `overflow: hidden` を持つ。メニューをこの子のまま置くと、開いた直後に行う先頭項目への `.focus()` がブラウザ標準のscroll-into-view挙動を誘発し、`.mle-colstack` 自身が（`overflow:hidden` であっても）スクロール対象と判定されて `scrollLeft` が動いてしまい、メニューの描画位置が大きくずれる不具合を実機で確認した（`AncestorStack.tsx` のコメント・コミットログ参照）。アンカー自体をmotion化して幅アニメーションを持たせる案は採らなかった。幅アニメーションする要素とメニューの配置基準を同一要素にすると、この `overflow:hidden`・`scrollLeft` の問題が再発するため、「幅アニメーションする要素」と「`overflow:hidden` の影響を受けないメニューの配置基準」を兄弟として分離する必要があった。

TASK-243と合わせて、ラッパー例外は次のいずれかの条件で許容する。**(1) ルート要素にpadding/borderがありcollapseで見切れる場合は `overflow: hidden` だけを持つ無地のラッパーを外側に1枚被せる。(2) ルート要素が `overflow: hidden` かつ幅/高さアニメーション対象で、その内側に置けない子（自身の確定幅/高さを超える絶対配置のポップオーバー等）を持つ場合は、位置決め基準を無地の兄弟ラッパーへ分離する。**

### useIsPresent の用途に「退出時の子ポップオーバーの強制close」を追加（TASK-429）

原則3は `useIsPresent()` の用途を (a) `inert`、(b) リスナーの退出中解除に限定し、TASK-240で (c) 再オープン時の初期フォーカスへ拡張した。TASK-429で4つ目の用途が生じた。

`EllipsisSpine` は自身の一覧メニュー（`role="menu"`）をローカルstate（`open`）で開閉する。メニューを開いたまま階層移動してこの背表紙自体がAnimatePresenceの退出アニメへ入ると、`.mle-colstack-anchor` は子（幅アニメーション対象の `.mle-colstack`）の幅に追従する素朴なブロック要素であるため、メニューが縮む背表紙に追従して横に動きながら消える見た目の不具合が実機で再現した（実測: `history.back()` で退出をトリガーし、退出アニメ中の複数フレームでメニューの座標が連続的にずれることを確認）。

`isPresent` が `false` になった時点（退出が確定した瞬間）で `setOpen(false)` し、ずれた状態が見える前にメニューを閉じることで対処した。原則3の禁止事項（「閉じたときのフォーカス復帰に使わない」）が想定していた失敗モード（軸A→B切替時に旧Aが新Bからフォーカスを奪う）とは無関係の用途であり、フォーカス復帰も行わないため、この禁止事項には抵触しない。よって用途を4つに拡張する。
