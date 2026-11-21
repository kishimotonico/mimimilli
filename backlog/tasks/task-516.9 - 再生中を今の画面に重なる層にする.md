---
id: TASK-516.9
title: 再生中を今の画面に重なる層にする
status: To Do
assignee: []
created_date: '2026-11-21 20:24'
labels:
  - player
  - navigation
  - ui
dependencies:
  - TASK-516.7
documentation:
  - docs/adr/0041-library-sidebar-shell-navigation.md
parent_task_id: TASK-516
priority: high
ordinal: 610000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0041「再生中の層」の実装。AppRoute の mode: nowPlaying をなくし layer（開き方 app / url）にする。URL は下の画面に np=1 を足す（/now-playing はなくなる）。閉じ方（アプリ内で開いたなら履歴を1件戻る、URL を直接開いたなら置き換えで np を外す）、再生なしで np=1 に着いたとき（再読み込み・進むを含め、同じ規則）、層から別画面へ進むとき（層のエントリーを置き換え。作品名→作品詳細、タグ→「すべて」＋タグ。下がファイルでも同じ）、Esc（通常・没入どちらでも層を閉じ、没入の切り替えはボタンだけ）、再生バー（bar モード）に ⤢ を足す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 再生バーとポップアップの ⤢ で層が開き、URL に np=1 が付き、下の画面（ライブラリ・作品詳細・ファイル）が残る
- [ ] #2 「お気に入り → CV別 → 層を開く → Esc → 戻る」でお気に入りに着く
- [ ] #3 np=1 の URL を直接開いて閉じてもアプリの外へ出ず、再生していないときは層が開かない
- [ ] #4 層の作品名から作品詳細へ進み、戻ると層を開く前の画面（ファイルならその位置）に着く
- [ ] #5 没入表示でも Esc で層が閉じ、没入の設定は変わらない
- [ ] #6 nowPlaying 系の smoke を層の形に書き換えて pnpm test:smoke が通る
<!-- AC:END -->
