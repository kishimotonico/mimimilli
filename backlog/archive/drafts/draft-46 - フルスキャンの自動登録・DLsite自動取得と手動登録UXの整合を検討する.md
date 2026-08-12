---
id: DRAFT-46
title: フルスキャンの自動登録・DLsite自動取得と手動登録UXの整合を検討する
status: Draft
assignee: []
created_date: '2026-08-01 19:55'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
出典: TASK-164/165検証 2026-08-02。フルスキャンはメタ無し音声フォルダへ自動でmimimilli.jsonを生成し作品登録する（要件v4 §3.5の既存仕様）。さらに検証で、フォルダ名のRJコードからDLsite情報の自動取得・適用まで走ることを実測（_verify164_RJ01234567 が実在の別作品『【繁体中文版】そーちゃんのお人形遊び』として登録された）。TASK-164の手動登録UX（タイトル吟味・DLsite取得を確認してから登録）と衝突し、誤ったRJコードだと無関係な作品情報が付く実害もある。自動登録のオプトアウト・下書き扱い・スキャン時確認など方向性は未定。要件を決めてからタスク化する。
<!-- SECTION:DESCRIPTION:END -->
