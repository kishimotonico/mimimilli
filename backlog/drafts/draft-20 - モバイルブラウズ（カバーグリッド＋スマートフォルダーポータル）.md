---
id: DRAFT-20
title: モバイルブラウズ（カバーグリッド＋スマートフォルダーポータル）
status: To Do
assignee: []
created_date: '2026-07-10 12:34'
updated_date: '2026-07-11 10:53'
labels: []
dependencies:
  - TASK-30
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スマホでの「探す」体験。方針はADR-0005（docs/adr/0005-mobile-ui-strategy.md）に従う。カバー主体のグリッドで一覧し、PCで作成済みのスマートフォルダーを入口（ポータル）として使う。スマートフォルダーの編集UIは持ち込まない。ボトムタブの「お気に入り」はお気に入りタグでの絞り込みビューとして実現する（マーキングのタグ方針前提）。TASK-14（グリッド表示）・TASK-24（サムネイルAPI）の成果を前提に、モバイル幅での列数・タップ挙動を整える。検索はタグタップ絞り込み中心でキーボード入力を最小にする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スマホ幅でカバーグリッドが表示され、タップで作品を開ける
- [ ] #2 スマートフォルダー一覧から各フォルダーを開ける（編集導線は出さない）
<!-- AC:END -->
