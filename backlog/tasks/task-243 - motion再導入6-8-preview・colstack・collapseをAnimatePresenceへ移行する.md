---
id: TASK-243
title: 'motion再導入(6/8): preview・colstack・collapseをAnimatePresenceへ移行する'
status: Done
assignee: []
created_date: '2026-08-07 17:01'
updated_date: '2026-08-07 21:19'
labels: []
dependencies:
  - TASK-238
ordinal: 253000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
確定仕様は docs/adr/0014-motion-reintroduction-presence-removal.md のcollapse確定事項とこのタスク本文（フェーズ6）。LibraryView preview-slide（PreviewPaneを{selectedWorkId && <PreviewPane selectedWork={...}/>}に境界化。現在はRQキャッシュへの暗黙依存で偶然表示されている）、FilesView colstack-width（initial={false}）、AxisValueQuickList collapse。collapseはTASK-238で確立しTASK-241で実証済みのvariant（motion公式サポートのheight:0↔auto + opacity + overflow:hidden。gridトリックは廃止、内側の子レイアウトflex/gapは維持）を適用する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 preview退出中に作品情報が消えない(PreviewPaneのprops境界化)
- [x] #2 FilesViewの初回表示にアニメが走らない
- [x] #3 pnpm check・変更範囲のテスト・pnpm test:smoke が通る
- [x] #4 collapseの見た目・クリッピングが現行同等(複数子要素のgap含む)で、ADR-0014確定のheight:0↔auto + opacity + overflow:hidden方式になっている(gridTemplateRows直接アニメは不採用)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
preview-slide・colstack-width・collapseの3箇所をAnimatePresenceへ移行し、これで旧Presenceの消費者がゼロになった。LibraryViewはPreviewPaneSlideを境界化し{selectedWorkId !== null && ...}の条件レンダーへ移行。旧実装はselectedWorkIdがnullになると同一レンダーでworkDetailQueryのqueryKeyがdetail("")に変わりselectedWorkが即nullになる一方、Presenceは同じ要素を再レンダーし続けるため退出中に中身が消える構造的バグがあった。FilesViewはColstackBackButtonをmotion.button化しinitial={false}で対応表#2を消化。AxisValueQuickListのソートメニューは.mll-qlist__sortがpadding/borderを持つためルート化できず、overflow:hiddenのみの無地ラッパーを1枚外側に置く方式にした(ADRの前提記述が誤りだったため訂正済み。旧実装は2段ラッパーだったのでラッパーは純減)。退出中に作品情報が消えないことをrequestAnimationFrameポーリングで実測(t=32〜262msでpresent:true/opacity:1/作品名表示、t=280msでDOM除去)。
<!-- SECTION:FINAL_SUMMARY:END -->
