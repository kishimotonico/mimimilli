---
id: DRAFT-17
title: PWA対応（ホーム画面追加・スリープタイマー）
status: Draft
assignee: []
created_date: '2026-07-10 12:35'
labels: []
dependencies:
  - TASK-30
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スマホでアプリとして使えるようにする仕上げ。manifest追加でホーム画面に追加可能にし、テーマカラー・アイコンを整備。就寝用途向けにスリープタイマーを追加する。オフラインキャッシュは初期スコープ外。外出先アクセス（Tailscale等）や帯域向けトランスコードも本ドラフトのスコープ外で、必要になったら別途起票する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ホーム画面に追加してスタンドアロン表示で起動できる
- [ ] #2 スリープタイマーで指定時間後に再生が停止する
<!-- AC:END -->
