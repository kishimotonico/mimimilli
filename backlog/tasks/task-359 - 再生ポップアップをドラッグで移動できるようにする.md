---
id: TASK-359
title: 再生ポップアップをドラッグで移動できるようにする
status: Done
assignee: []
created_date: '2026-08-20 17:01'
updated_date: '2026-08-20 17:41'
labels: []
dependencies: []
ordinal: 359000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
現状ポップアップは右下固定(right:16px/bottom:24px, 幅336px, client/src/styles/shell/player-a.css の .mle-popup)で、作品詳細の右ペインと完全に重なって不便。ドラッグで任意位置へ移動可能にする。

実装方針:
- motion(v13, 導入済み)のdrag機能で実装。ヘッダー等をつかんでドラッグ
- 位置はjotai atomWithStorage(localStorage, 既存キー例: mimimilli:playerUiMode)で永続化
- 初期位置へ戻す操作は2つ: (a)ポップアップ余白のダブルクリック (b)初期位置付近へドラッグすると磁石のように吸着して初期位置状態へ戻る。専用ボタンは追加しない
- ウィンドウリサイズ等で画面外にはみ出したら自動で画面内にクランプ
- 高頻度atom購読設計(playerCurrentTimeAtom等はleafのみ購読)を壊さないこと。docs/HANDOFF.md参照
- 統合ブランチ feat/player-ux 配下の作業ブランチで実施
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ポップアップをドラッグで任意位置に移動できる
- [x] #2 位置がlocalStorageに永続化されリロード後も維持される
- [x] #3 ポップアップ余白のダブルクリックで初期位置(右下)に戻る
- [x] #4 初期位置付近へドラッグすると吸着して初期位置状態に戻る
- [x] #5 画面外にはみ出した場合(リサイズ等)は画面内へ自動クランプされる
- [x] #6 bar⇄popup切替・全画面展開など既存動作が維持される
- [x] #7 pnpm test:smoke が通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
再生ポップアップをmotionの制御ドラッグで移動可能にした。位置はatomWithStorage(mimimilli:playerPopupOffset, getOnInit:true)で永続化。余白ダブルクリックで初期位置復帰、原点70px以内で吸着、resize時は画面内へ自動クランプ。レビュー指摘2件（scale適用中の可動域誤算出→offsetWidth/getComputedStyleベースへ、無移動クリックの書き込み→吸着・非吸着両パスに同値ガード）を解消。check/test(824)/smoke(17)全緑、再生中タブ共存の実機確認済み。feat/player-uxへff取り込み済み
<!-- SECTION:FINAL_SUMMARY:END -->
