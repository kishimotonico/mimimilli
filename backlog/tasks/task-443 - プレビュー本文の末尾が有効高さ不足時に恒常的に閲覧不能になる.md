---
id: TASK-443
title: プレビュー本文の末尾が有効高さ不足時に恒常的に閲覧不能になる
status: To Do
assignee: []
created_date: '2026-09-09 15:43'
labels:
  - ui
  - bug
  - layout
dependencies: []
priority: medium
ordinal: 464000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-438 の検証中に発見。438 が持ち込んだ退行ではなく、既存の構造上のバグ（438 前後で数値が完全に同一であることを実測で確認済み）。

構造: client/src/styles/shell/preview-a.css の .mle-prv-anchor → .mle-prv（overflow:hidden）→ .mle-prv__body（flex:1 のみ、min-height:0 なし）。

.mle-prv__body は min-height:0 を持たないため、有効高さが狭いときに自身を縮めず自然サイズのまま描画される。祖先 .mle-prv の overflow は auto ではなく hidden なので、はみ出した分はスクロールで到達できずクロップされる。

実測（1000px・プレイヤーpopupをドックした状態、438 前後とも同一の値）:

  .mle-prv__body clientHeight: 584
  .mle-prv__body scrollHeight: 1042
  .mle-prv（クリップ枠）の実描画高さ: 210

内部を最大までスクロールしてもクロップ窓の可動域は元コンテンツの先頭側にしか届かず、末尾側の約374px分が恒常的に閲覧不能。

popup ドック時に限らず、ウィンドウ高さが狭い状況全般で発生しうる。

想定される対処: .mle-prv__body へ min-height: 0 を追加し、自身が有効高さに収まるスクロールコンテナとして機能するようにする（実装時に検証すること）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 有効高さが内容より狭いとき、プレビュー本文の末尾までスクロールで到達できる
- [ ] #2 プレイヤーpopupをドックした状態と、ウィンドウ高さが狭い状態の両方で確認されている
- [ ] #3 clientHeight と scrollHeight の実測値を修正前後で比較し記録している
<!-- AC:END -->
