---
id: TASK-54
title: バーへの前/次トラックボタン追加
status: To Do
assignee: []
created_date: '2026-07-05 18:00'
updated_date: '2026-07-19 01:33'
labels:
  - player
  - future
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
再生バー（BarContent）に前/次トラックボタンを追加する。MediaSession対応（TASK-52）で nextTrack/prevTrack の配線は整備済みで、UIボタンを置くだけに近い。マルチトラック再生の改善（TASK-50・51）でトラック移動の利用頻度が上がったため追加を決定（2026-07-19）。

実装: client/src/features/player/ui/BarContent.tsx に前/次ボタンを追加。先頭/末尾トラックで該当ボタンをdisabled。アイコン・配置は既存のバーUI・docs/design-system.md の規約に従う。狭幅時の収まりに注意。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 再生バーに前/次トラックボタンが表示され、クリックでトラックが移動する
- [ ] #2 先頭トラックで前ボタン、末尾トラックで次ボタンがdisabledになる
- [ ] #3 狭幅でもバーのレイアウトが崩れない
- [ ] #4 pnpm check と pnpm test が通る
<!-- AC:END -->
