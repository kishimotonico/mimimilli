---
id: DRAFT-22
title: 続きから再生（再生位置のサーバー保存・デバイス間引き継ぎ）
status: Draft
assignee: []
created_date: '2026-07-11 10:53'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
作品ごとの再生位置をサーバー側に記録し、PCで途中まで聴いた作品をスマホで続きから再生できるようにする（逆方向も同様）。ADR-0005でモバイル初期スコープ外と決定した機能で、モバイルUI一式（DRAFT-13〜17相当）の完成後の最有力候補。音声作品は長尺でトラックをまたぐため、work単位でトラックindex＋秒位置を保存する想定。保存タイミング（一時停止時・定期）と複数デバイス同時再生時の競合方針は着手時に決める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 再生位置がサーバーに保存され、別デバイスから同じ作品を開くと続きから再生できる
<!-- AC:END -->
