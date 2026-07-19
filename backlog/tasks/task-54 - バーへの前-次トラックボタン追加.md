---
id: TASK-54
title: バーへの前/次トラックボタン追加
status: Done
assignee:
  - '@codex'
created_date: '2026-07-05 18:00'
updated_date: '2026-07-19 01:46'
labels:
  - player
  - future
dependencies: []
modified_files:
  - client/src/features/player/ui/BarContent.tsx
  - client/src/features/player/ui/PlayerDock.tsx
  - client/src/styles/shell.css
  - client/tests/unit/barContent.test.ts
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
再生バー（BarContent）に前/次トラックボタンを追加する。MediaSession対応（TASK-52）で nextTrack/prevTrack の配線は整備済みで、UIボタンを置くだけに近い。マルチトラック再生の改善（TASK-50・51）でトラック移動の利用頻度が上がったため追加を決定（2026-07-19）。

実装: client/src/features/player/ui/BarContent.tsx に前/次ボタンを追加。先頭/末尾トラックで該当ボタンをdisabled。アイコン・配置は既存のバーUI・docs/design-system.md の規約に従う。狭幅時の収まりに注意。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 再生バーに前/次トラックボタンが表示され、クリックでトラックが移動する
- [x] #2 先頭トラックで前ボタン、末尾トラックで次ボタンがdisabledになる
- [x] #3 狭幅でもバーのレイアウトが崩れない
- [x] #4 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. BarContentへ前・再生/一時停止・次の操作グループを追加し、PlayerDockの既存onPrev/onNext配線を渡す
2. 先頭/末尾のdisabled状態、aria-label、design-system準拠のカーソルと狭幅レイアウトをCSSで整える
3. 既存テスト構成を確認し、妥当な範囲のテストまたは静的検証を行う
4. pnpm checkとpnpm testを実行し、受け入れ条件と完了情報をBacklogへ記録する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
BarContentの操作部を固定幅の前・再生/一時停止・次グループに変更。曲名領域は既存のflex縮小とellipsisを維持し、操作群はflex-shrink: 0として狭幅でも崩れない構造にした。disabledボタン由来のクリックではポップアップへ切り替わらないよう、親クリック処理でbuttonを除外した。
検証: pnpm check 成功。pnpm test 成功（server 20件、client 235件）。BarContentのコンポーネントテスト2件を追加。ブラウザ確認は依頼どおり委譲元で実施する。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
再生バーへ既存アイコンを使った前/次トラックボタンを再生ボタンの両脇に追加し、PlayerDockの既存アクションへ配線した。先頭/末尾では該当操作をdisabledにし、not-allowedカーソルと狭幅向けの固定操作群を整備。コンポーネントテストを追加し、pnpm checkとpnpm testの成功を確認した。
<!-- SECTION:FINAL_SUMMARY:END -->
