---
id: DRAFT-34
title: 横断サーフェス（再生中・履歴・お気に入り・ピン留め）の去就を決める
status: Draft
assignee: []
created_date: '2026-07-30 15:29'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DRAFT-30（実装だけ存在してUIから到達できない機能の去就）の残り分。検索プリセットは2026-07-30に「削除」で決着し TASK-150 に起票済みのため、本ドラフトは横断サーフェスのみを扱う。

現状: client/src/app/ui/LeftNav.tsx の SURFACES が disabled かつ title="近日実装" でレンダリングされ、クリックできない。playingCount を算出して渡す配線まであるが、ボタンが押せないため badge が表示されることはない。要件7.2は「横断サーフェスの存在」を求めているが機能実装までは要求していない。

決めたいこと（いずれか）:
- 使う: いつ・どの画面から使うかを決めてフロント実装のタスクを切る（実装検討は DRAFT-7 にあり）
- 使わない: UI・配線ごと削除する
- 保留を続ける: 理由と次に見直す条件（時期・きっかけ）を明記する

参考: 横断サーフェスは「お気に入り」「ピン留め」というマーキング機能（DRAFT-21）に依存する。
<!-- SECTION:DESCRIPTION:END -->
