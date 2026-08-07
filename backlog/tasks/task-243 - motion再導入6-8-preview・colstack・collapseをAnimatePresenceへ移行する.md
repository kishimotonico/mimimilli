---
id: TASK-243
title: 'motion再導入(6/8): preview・colstack・collapseをAnimatePresenceへ移行する'
status: To Do
assignee: []
created_date: '2026-08-07 17:01'
updated_date: '2026-08-07 17:16'
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
- [ ] #1 preview退出中に作品情報が消えない(PreviewPaneのprops境界化)
- [ ] #2 collapseの見た目・クリッピングが現行同等(複数子要素のgap含む)でgridTemplateRows直接アニメ方式になっている
- [ ] #3 FilesViewの初回表示にアニメが走らない
- [ ] #4 pnpm check・変更範囲のテスト・pnpm test:smoke が通る
<!-- AC:END -->
