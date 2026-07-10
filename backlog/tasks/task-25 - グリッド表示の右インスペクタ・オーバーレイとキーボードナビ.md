---
id: TASK-25
title: グリッド表示の右インスペクタ・オーバーレイとキーボードナビ
status: Done
assignee:
  - '@codex'
created_date: '2026-07-07 11:59'
updated_date: '2026-07-10 10:08'
labels:
  - feature
  - frontend
dependencies:
  - TASK-14
priority: medium
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
グリッド表示で作品を選択したときの詳細ペインの見せ方。お兄ちゃんが懸念した『詳細パネルがグリッドを押し込むと列数が変わって全タイルがリフローし、スクロール位置がズレて操作しづらい』問題を回避するのが主眼。

方針（設計確定事項・ユーザー選択済み）:
- 詳細は右端に固定した『インスペクタ』を、グリッドの上に重ねて（オーバーレイして）表示する。グリッドの grid-template-columns は変えず、選択のたびのリフローを起こさない。
- リフローが起きるのはインスペクタの開閉（空↔表示）の瞬間だけにし、作品を次々クリックして中身が差し替わる間はグリッドを一切組み替えない（トリアージ用途を優先）。
- インスペクタが開いている間、選択タイルがパネルの下に隠れないようにする（選択時にそのタイルをパネル外の可視領域へスクロールで送る、もしくは開いている間だけグリッドに右ガター/右マージンを確保して最右列がパネル下に入らないようにする。どちらを採るかは実装時に検証して決める）。
- 中身は既存の WorkDetail（client/src/features/library/ui/preview/WorkDetail.tsx）を再利用する。
- 閉じる操作: ✕ボタン / Esc / 空きグリッド領域のクリック。別タイルのクリックは閉じずに内容更新。
- キーボードナビ: 矢印キーでタイルのフォーカス移動（左右=±1、上下=±列数）、Enter/ダブルクリックで再生。グリッドはリストと違い2次元移動が要るため必須。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 グリッドで作品を選ぶと右端にインスペクタが重なって表示され、WorkDetailの内容が出る
- [x] #2 作品を次々クリックしてもグリッドがリフローせず、スクロール位置・タイル配置が保たれる
- [x] #3 インスペクタ表示中、選択したタイルがパネルの下に隠れず視認できる
- [x] #4 ✕ / Esc / 空き領域クリックでインスペクタを閉じられ、別タイルのクリックでは閉じず内容が更新される
- [x] #5 矢印キーでタイル間をフォーカス移動でき、Enter/ダブルクリックで再生できる
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codex実装（worktree、コミット 8ae1b53）、Fableが実機検証: インスペクタ表示（WorkDetail再利用・z=20）、選択切替時のgrid-template-columns完全一致とスクロール位置維持（リフロー無し）、Esc/✕/空き領域クリックで閉じる、矢印キー（右+1・下+列数）でのフォーカス移動、Enter再生。可視化方式は右ガター確保案を採用（scrollIntoView案はトリアージ時の位置保持と相性が悪いため見送り、妥当と判断）。design-system.mdのz-index表も更新済み。マージ後 check・client 91件・ビジュアル6件全パス。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
グリッド選択時の詳細を右オーバーレイのインスペクタに変更（リフロー無し・右ガター方式）、矢印キーの2次元ナビとEnter再生を追加。コミット 8ae1b53（マージ済み）。
<!-- SECTION:FINAL_SUMMARY:END -->
