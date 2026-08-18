---
id: DRAFT-67
title: smokeテストにモバイルビューポートを追加
status: Draft
assignee: []
created_date: '2026-08-18 23:12'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DRAFT-18 の本文を現状に合わせて書き直したもの（2026-08-19の棚卸し）。旧本文は「ビジュアルテスト（ピクセル比較スナップショット）にモバイル幅を追加する」という前提だったが、その基盤はもう無い。

## 前提の変化

TASK-221 でピクセル比較スイートは廃止され、`test:visual` スクリプトごと削除、`test:smoke` に一本化された。`client/package.json` に `test:visual` はなく、`client/tests/` に `*.visual.spec.ts` も `toHaveScreenshot` も存在しない。

したがって「スナップショットをCIで検証する」という形の受け入れ条件はもう書けない。

## やること

Playwrightのsmoke（`client/tests/smoke/*.smoke.spec.ts`）にモバイル幅のビューポートを追加し、モバイルレイアウトの回帰を挙動レベルで検出する。現行のsmokeはデスクトップ幅前提の記述が主。

決めること:
- 対象画面（ライブラリ・プレイヤーあたり）
- デスクトップ用specにビューポート指定を足すか、モバイル専用specを分けるか
- Playwrightのproject分割で回すか、単一projectでビューポートを切り替えるか

## 着手条件

モバイルシェル（DRAFT-19）が実装されるまで、検証する対象そのものが存在しない。DRAFT-19 完了後に着手する。
<!-- SECTION:DESCRIPTION:END -->
