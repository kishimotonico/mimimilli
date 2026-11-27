---
id: TASK-532
title: スキャンの縦タブを Ark のタブに置き換え、矢印キー移動とパネルの対応をライブラリに任せる
status: To Do
assignee: []
created_date: '2026-11-27 13:58'
labels:
  - ui
dependencies:
  - TASK-531
priority: low
ordinal: 656000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
手書きの `role="tab"` は矢印キー移動も roving tabindex も無く、4つのタブがすべて Tab で止まる。`aria-controls` と `id` の対応も文字列を手で組んでいる。Ark の Tabs に置き換える。
範囲: `ScanSidebar` の縦タブ4つと `ScanModal` のパネル（`activeTab` の `null` 初期状態、`landingTab`、スキャン完了後の自動移動、`document.getElementById` で引いているフォーカス移し）。サイドバーの開始／中止ボタンと状態欄は `Tabs.Root` の中に置くが、動作（スキャン開始→中止の入れ替え時のフォーカス引き継ぎ）は変えない。
対象外: 各タブの中身（未登録・要対応・新規作品・更新済み）。

実装方針（既定で決める。変えたければ着手前に相談する）:
- `orientation: vertical`。矢印キーはフォーカスを動かすだけで、選択は Enter／Space で行う（`activationMode: manual`）。タブの切り替えごとに一覧の読み込みが走るため。`loopFocus` は有効。Tab でタブ列に入ると選択中のタブに止まる
- パネルは選択中のタブの分だけマウントする（従来どおり。`lazyMount` と `unmountOnExit`）
- タブの名前は「{ラベル}（{n}件）」のまま。件数バッジ・danger 色・枠線のアクセント・行の高さ固定の見た目は従来どおり

共通の前提:
共通の前提（各タスクの説明に書く）:
- 段階4のマージ後の master から切る。ダイアログは Ark の Dialog になっていて、ネイティブ dialog 向けの例外（`layerContainer` の dialog 分岐など）は無い
- 各所で Ark の部品を直接組む。汎用ラッパーは作らない（ADR-0043）。共通にするのは見た目のクラス・既定値に限る
- 置き換えたものから旧実装を削除する。互換レイヤーは入れない
- 実装中は変更範囲のテスト。`pnpm check && pnpm test` はタスク完了時に1回。UI を変えるので `pnpm test:smoke` を AC に含める
- ADR-0043 の書き換え（adr-0043-changes.md）は TASK-529 のマージ後に済んでいる前提
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 縦タブとパネルが Ark の Tabs になり、手書きの `role="tab"` と `scan-tab-*`／`scan-tabpanel-*` の文字列組み立てが `rg` で残らない
- [ ] #2 上下の矢印でタブ間のフォーカスが動き、Enter／Space で選択される。Home／End が効き、Tab でタブ列に入ると選択中のタブに止まる
- [ ] #3 `getByRole("tab", { name })` を使う smoke（約25行）がロケータを変えずに通る。着地（`landingTab`、件数が決まるまで未選択）とスキャン完了後の自動移動が従来どおり動く
- [ ] #4 候補をすべて追加したときのフォーカス移しが従来どおり動き、DOM の id 文字列の決め打ち（`document.getElementById`）が無い
- [ ] #5 スキャンの開始→中止の入れ替え時のフォーカス引き継ぎ（`ScanSidebarFocus.test`）が壊れない
- [ ] #6 `docs/design-system.md` の縦タブの節が実装と一致している。`pnpm check && pnpm test` と `pnpm test:smoke` が通る
<!-- AC:END -->
