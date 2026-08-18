---
id: DRAFT-21
title: マーキング機能（お気に入り・あとで整理タグのトグル）
status: To Do
assignee: []
created_date: '2026-07-10 12:35'
updated_date: '2026-07-11 10:53'
labels: []
dependencies:
  - TASK-30
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スマホから許す唯一の書き込み。ADR-0006の決定により、作品に独立フィールドは追加せず既存タグ機構で表現する（フラットタグ「お気に入り」「あとで整理」）。

- shared契約・サーバーAPIの変更は不要の見込み。既存のタグ更新APIを流用する
- スマホUIではタグ編集UIは出さず、この2タグ限定のトグルボタンとして見せる
- PC側はLeftNavの「お気に入り」（client/src/app/ui/LeftNav.tsx のstarラベル、現状未配線）をお気に入りタグの絞り込みビューとして配線する（DRAFT-7と関連、重複しないよう着手時に整理）
- タグの保護（改名・削除の禁止）はしない。運用で困ったら予約タグ化を検討（ADR-0006参照）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スマホUIの作品ビューから「お気に入り」「あとで整理」をトグルでき、タグとして永続化される
- [ ] #2 PCのLeftNav「お気に入り」からお気に入りタグの絞り込みビューを開ける
- [ ] #3 スマートフォルダーのタグ条件で「あとで整理」の作品を一覧できる
<!-- AC:END -->
