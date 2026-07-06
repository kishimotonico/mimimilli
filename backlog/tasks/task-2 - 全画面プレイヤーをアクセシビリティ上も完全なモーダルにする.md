---
id: TASK-2
title: 全画面プレイヤーをアクセシビリティ上も完全なモーダルにする
status: Done
assignee:
  - '@claude'
created_date: '2026-07-05 17:58'
updated_date: '2026-07-06 03:34'
labels:
  - ui
  - player
dependencies: []
references:
  - docs/issues/2026-07-03-live-ui-ux-review.md
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
全画面プレイヤー表示中も、アクセシビリティツリーに背面の検索欄・ナビ・作品詳細・ポップアップの要素が残っており、Tab移動で背面要素に到達しうる。見た目は全画面だが、キーボード/スクリーンリーダー上はモーダルとして機能していない。エンジン側の再生機能自体は実装済みで、UI/アクセシビリティ配線のみが残作業。BACKLOG.mdの『全画面プレイヤーのフォーカストラップ』(プレイヤーセクション)と同一課題のため統合。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 全画面プレイヤー表示中は背面のアプリ本体を inert 相当にする
- [x] #2 aria-modal="true" と role="dialog"、または画面全体を占有するプレイヤーに適したランドマークを付与する
- [x] #3 開いた際のフォーカス初期位置を「縮小」または主再生ボタンに移す
- [x] #4 Tab/Shift+Tabの移動をプレイヤー内に閉じ込める（フォーカストラップ）
- [x] #5 Escで閉じた後、開く前にフォーカスがあったボタンへフォーカスを戻す
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
方針: ネイティブ<dialog> + showModal()で実装（ユーザー承認済み）
1. FullScreenPlayerのルートをfixed divから<dialog>に変更し、マウント時にshowModal()、アンマウント時にclose()
2. Escは既存のkeydownリスナーを削除しdialogのcancelイベント経由でonCloseに接続
3. 初期フォーカスは「縮小」ボタン（AC#3）
4. フォーカストラップと背面inert化はshowModal()の標準挙動に任せる
5. 閉じた際のフォーカス復元はネイティブ挙動を確認し、React unmountで壊れる場合は明示的に復元
6. aria-labelはトラック/作品タイトルと連動
7. 実装はCodexへ委譲、実ブラウザでのTab閉じ込め・フォーカス復元検証はClaude
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装はCodexへ委譲（ネイティブdialog方針はユーザー承認済み）、レビュー・実ブラウザ検証・コミットはClaude。

実ブラウザ検証結果:
- 表示中のa11yツリーがプレイヤー内要素のみになり、背面（検索欄・ナビ・作品リスト・devtoolsボタン）が完全に消えることを確認（showModalのinert効果）
- 初期フォーカス=縮小ボタン、Tab15回押下でもフォーカスはdialog内を巡回
- Escで閉じると、開く前にフォーカスがあった「全画面プレイヤー」ボタンへ復元
- role/aria-modalはネイティブdialogの暗黙値に任せ、明示付与なし（冗長回避）
- pnpm check / test 73件 / test:visual 6件 全通過

補足: top-layer描画になったためz-index運用から外れる（shell.cssのコメント更新済み）
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
全画面プレイヤーをネイティブdialog+showModal()でモーダル化。背面inert・フォーカストラップ・初期フォーカス・Esc・フォーカス復元の5要件すべて実ブラウザで検証済み（コミットは直前のfeatコミット）
<!-- SECTION:FINAL_SUMMARY:END -->
