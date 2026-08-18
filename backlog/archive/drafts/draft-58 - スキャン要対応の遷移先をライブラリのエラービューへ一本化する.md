---
id: DRAFT-58
title: スキャン要対応の遷移先をライブラリのエラービューへ一本化する
status: Draft
assignee: []
created_date: '2026-08-13 17:00'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー2026-08-14の積み残し。現在「RJコード未検出」だけが専用モーダル（activeModal: rj-missing）へ遷移し、TASK-304で作った包括エラービュー（軸ID: error）とは別系統になっている。スキャンモーダルの要対応タブ（TASK-326）からの「一覧を見る」もエラービューへ送る設計にしたため、通知ベルからの導線も含めて行き先を一本化できる。あわせてエラービュー側で種類（行方不明・外部連携失敗・RJコード未検出）による絞り込みを持たせるかを決める。範囲が広いため要件を固めてからタスク化する。関連: TASK-299（作品削除）、DRAFT-23（行方不明作品の整理）。
<!-- SECTION:DESCRIPTION:END -->
