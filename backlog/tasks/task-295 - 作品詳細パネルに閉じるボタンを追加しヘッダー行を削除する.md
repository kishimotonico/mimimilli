---
id: TASK-295
title: 作品詳細パネルに閉じるボタンを追加しヘッダー行を削除する
status: Done
assignee:
  - '@sonnet'
created_date: '2026-08-10 18:59'
updated_date: '2026-08-11 05:19'
labels: []
dependencies: []
ordinal: 305000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
詳細パネルを閉じる手段が空白クリックとEscのみで操作しづらい（client/src/features/library/ui/workGrid/useWorkGridDismiss.ts:1-44）。パネルの外側左端に縦長の右矢印ボタンを設置し、クリックで既存のスライドアウトアニメーション（client/src/shared/ui/useMotionVariants.ts:245-257 の previewSlideVariant、LibraryView.tsx:64-73 PreviewPaneSlide）に乗せて閉じられるようにする。あわせて、パネル最上部のヘッダー行（「詳細」ラベルのみで機能を持たない。client/src/features/library/ui/PreviewPane.tsx:57-60、client/src/styles/shell/preview-a.css:20-32）を削除してコンテンツ領域を広げる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 詳細パネル脇の縦長右矢印ボタンでパネルが閉じられる（アニメーション付き）
- [x] #2 既存の空白クリック・Escでの解除も引き続き動作する
- [x] #3 「詳細」ラベルのヘッダー行が削除される
- [x] #4 pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PreviewPane.tsxのヘッダー行(.mle-prv__hd)をmode==='work'では非表示化（mode==='home'とFilePreview.tsxは共有クラスのため残す）。LibraryView.tsxのPreviewPaneSlideに縦長の閉じるボタン(.mll-results__preview-close、I.chev、aria-label='詳細を閉じる')を追加、クリックでnav.selectWork(null)しスライドアウト。frame-c.cssに.mll-results__preview-closeを追加。空白クリック/Escは既存のuseWorkGridDismiss経由でそのまま動作（グリッド/リスト双方でagent-browser確認）。tsc通過。

【差し戻し対応1回目・根本原因の特定と修正】client/tests/smoke/library.smoke.spec.ts:175-192『主要画面でヨコ方向スクロールが発生しない』が repeat-each=5 で5/5失敗（統括レビュー実測45/50を再現・確認）。TASK-301として『既存フレーキー』と報告したのは誤りだった。

原因: client/src/features/library/ui/AxisQuickOverlay.tsx（placement=right、幅280pxで結果面へ張り出す設計、client/src/shared/lib/useHoverGroupCoordinator.ts経由）が、ページ全体リロード直後に静止したカーソル直下の軸行をブラウザのhover再計算で誤ってホバー扱いし自動的に開いていた。TASK-294でWorkListPane.tsxの.mle-col__hd（約30px強のヘッダー）を削除した結果、リスト行が上に詰まりオーバーレイの縦方向footprintと重なるようになって顕在化した。Playwrightのclick()はactionabilityチェックをヒットテストのポーリングのみで行い実イベントを発火しないため、開いたオーバーレイに対してホバー退出タイマーもoutsideクリック検知も一切トリガーされず30秒デッドロックしていた。

根本対策（useHoverGroupCoordinator.tsに実装）: (1) パネル・トリガーの外側へのpointerdownで即座に閉じる仕組みを追加（他ポップオーバーのusePopoverDismissal相当）。(2) 本質対策として『このページで一度も本物のpointermoveを観測していない間はホバー起動そのものを無視する』ガードを追加（hasGenuinePointerMovedRef）。

既存テストへの影響: useHoverGroupCoordinator.test.ts（5件、新規ガード用の1件を追加）とAxisColumn.test.tsx（1件、実ブラウザ同様に先行するdocument pointermoveをテストにも追加）を修正。

検証（1回目）: repeat-each=5 を2回実行（計10反復）、対象テストは10/10通過。pnpm test:smoke（通常1周）は10/10通過。pnpm check・pnpm testはともに全緑。

【差し戻し対応2回目・Codexレビュー指摘4件】マージ前レビューで4件の指摘を受け、統括確認済みの3件+コメント記法1件を修正。

1) ホーム軸で詳細を閉じる手段が無い（LibraryView.tsx旧207-208）: isHome分岐は PreviewPaneSlide を経由せず PreviewPane を直接描画しており、閉じるボタンを持たなかった。閉じるボタンをPreviewPane.tsx自体に内蔵する設計に変更（mode==='work'のとき.mle-prv__closeを描画、onCloseは必須prop化）。PreviewPaneSlideは薄いスライドラッパーに戻し、isHome分岐にもonClose={() => nav.selectWork(null)}を配線。CSSは.mle-prv-shell（閉じるボタン+.mle-prvを横に並べる外枠）を新設、旧.mll-results__preview-closeは削除。grid/list/homeの3経路で同じ閉じ方に統一。agent-browserで3経路とも実機確認。

2) ホバーガードが初回ホバーを取りこぼす（useHoverGroupCoordinator.ts旧198-200）: 早期returnがhoveredTriggerRef更新より前にあり、ガード中に行の外へ出ずに動いても追従しなかった。hoveredTriggerRefの更新をガード判定より前に移動し、初回pointermove観測時にhoveredTriggerRefを見て再評価・openするよう修正。agent-browserで「ガードでブロック→行を出ずに本物のpointermove→追従して開く」を実測確認（bubbles:trueなpointerover/pointermoveイベントで検証。bubbles:falseのpointerenterはReactのポリフィルに拾われない点に注意）。

3) クエリ切替中に前の件数が残る（LibraryWorksBoundary.tsx旧107）: nav変更はほぼ全てuseTransition経由のため、pending中はLibraryWorksBoundary配下の再コミット自体が起きず、resetKeyベースの即時リセットは効果がないと判明（transitionが解決するまでサブツリー全体が旧コミットのまま）。真に必要なのは「ResolvedWorksがアンマウントされたら未確定に戻す」こと。ResolvedWorksのeffectをアンマウント専用のuseEffect(cleanup)に分離し、アンマウント時（Suspenseフォールバック表示・WorksErrorBoundaryのエラー捕捉のどちらでも発生）にonWorksTotalChange(undefined)を呼ぶよう修正。startTransition中の「旧一覧を薄表示のまま保持」ケースはアンマウントされないため、その間は直前の件数を出し続ける（結果面の挙動と一貫）。agent-browserでnetwork routeによりworks取得を意図的に失敗させ、エラー表示と同時に件数が消えることを実測確認（一時的にconsole.logを仕込んで実際にResolvedWorksがアンマウントされエラー経路で発火することも確認済み、検証後削除）。value-list↔works pane切替でも正しくリセット/復元されることを確認。

4) コメントの経緯記述: useHoverGroupCoordinator.tsの2箇所のコメントからTASK-IDと発生経緯の記述を削除し、現在の不変条件のみを簡潔に残した（テストファイル側のTASK-ID言及は既存の全体的な命名慣習のため維持）。

検証（2回目）: repeat-each=5 を実行、当該テスト含め全体50/50通過（3件の懸念フレーキーも今回は0件、環境要因の性質を裏付け）。pnpm test:smoke（通常1周）10/10通過。pnpm check・pnpm testはともに全緑（792+540件）。

【差し戻し対応3回目・Codex再レビュー】残り1件（LibraryWorksBoundary.tsx）を修正。もう1件（TASK-IDコメント削除の指摘）は統括判断で却下済み、対応不要。

問題: 前回の『アンマウント時cleanup』という設計は、すでに表示済みのSuspense境界が再サスペンドしたケースを取りこぼしていた。Suspenseはkey無しで使っており、再サスペンド時はReactがツリーをアンマウントせず非表示のまま保持するため（React 18のSuspense挙動）、passive effectのcleanupが発火しない。特に検索語のdebounce更新（useDebouncedValue、SEARCH_DEBOUNCE_MS=250ms）はstartTransitionの外で行われるため、CollectionStatus kind='loading'に切り替わっても前のクエリの件数がタグバンドに残り続けるケースがあった。

修正: <Suspense>のfallback自体を独立コンポーネント化（LoadingFallback）し、fallbackとして描画された瞬間（=サスペンドしていない通常のmountとして扱われる）にonWorksTotalChange(undefined)を呼ぶmount effectを追加。ResolvedWorks側のアンマウント時cleanup（エラー捕捉用）はそのまま維持。コード内コメントも実態に合わせて修正（アンマウント経由で拾えるのはエラー捕捉のみ、と明記）。

検証: window.fetchを一時的にモンキーパッチしてworks取得を1.5秒遅延させ、未キャッシュの検索語を入力→タグバンドの件数要素が消え(count=null)、フォールバック(読み込み中...)が表示されることを実測確認。1.5秒後にフェッチが解決すると正しい新件数（0件）に更新されることも確認。検索クリア（即時、debounceスキップ）でも正しく全件数に復元されることを確認。

検証コマンド: repeat-each=5 を2回実行（計10反復、対象の「ヨコ方向スクロール」テストは通算15/15で安定）。各回で別テスト1件ずつが単発失敗したが、いずれも既知の環境要因フレーキー（要素待ちタイムアウト、pointer-events blockedではない、単体repeat-each=15で1/30の頻度、以前の確認と同水準で増加なし）。pnpm test:smoke（通常1周）10/10通過。pnpm check・pnpm testはともに全緑（792+540件、フォーマット崩れを1件検出してoxfmtで修正済み）。

【差し戻し対応4回目・Codex最終レビュー】LibraryWorksBoundary.tsxのLoadingFallbackで、useEffectだとフォールバックがブラウザに描画された後に件数リセットが走るため、メインスレッドが混んでいると『読み込み中』と前クエリの件数が同時に一瞬見えるちらつきが起きうる、との指摘。useEffectをuseLayoutEffectに変更（ペイント前に反映）し、フォールバック表示と件数消去を同じ描画タイミングに揃えた。実質1行の変更。

検証: pnpm check 全緑。repeat-each=5（client/、--project=desktop-chromium --workers=1）50/50全通過（今回はflakeも0件）。LibraryWorksBoundary.test.tsx 2件通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
作品詳細パネルに縦長の閉じるボタン（ChevronRight、aria-label「詳細を閉じる」）を追加し、ヘッダー行「詳細」を削除。閉じるボタンはPreviewPane自身に内蔵し、ホーム軸埋め込み・グリッド/リストのスライドインの3経路で同じ閉じ方に揃えた。空白クリック・Escも従来どおり動作。
<!-- SECTION:FINAL_SUMMARY:END -->
