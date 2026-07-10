---
id: DRAFT-11
title: DLsiteスクレイパーの堅牢化（実在しない作品・RJコード誤検出・構造変更の検知）
status: Draft
assignee: []
created_date: '2026-07-10 10:30'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
存在しない作品や誤ったRJコードを取得しようとしたときに、失敗を分類して正しく報告できるようにする。

## 背景
現状の fetchDlsiteInfo は HTTP ステータスをメッセージに入れて throw するだけ。
- 実在しないRJコード・販売終了 → 404 だが「一時的エラー」と区別されない
- フォルダー名からの誤検出（RJ\d{6,8} の正規表現マッチ）で別作品を取ってしまう可能性
- DLsite の HTML 構造が変わるとタイトルが空文字のまま「成功」してしまう（現状パース結果の検証なし）

## 検討中の対応
- エラーの分類: not_found（404・恒久的）/ temporary（5xx・タイムアウト・ネットワーク）/ parse_error（タイトル空 = 構造変更疑い）を型で区別して返す
- パース結果の検証: title が空なら parse_error として失敗扱いにする
- 誤検出対策の検討: 取得結果のタイトルとフォルダー名の照合で「別作品っぽい」警告を出せるか（自動判定の精度は要検証。まずは手動確認UI側で吸収する案もあり）
- リダイレクト挙動の確認: 販売終了・年齢制限ページへの誘導がどう返るか実地調査が必要
- pure 関数（parseDlsiteHtml）のテスト拡充: 404ページ・空HTML・構造変更を模したフィクスチャ

## 関連
- server/src/adapters/real/dlsite.ts
- DRAFT-9 の status（not_found / error）に分類結果を流し込む
- dlsite.ts 冒頭の「セレクタの正典は docs/HANDOFF.md」コメントは実態と不一致なので、この機会に正典をコード側コメントに移す
<!-- SECTION:DESCRIPTION:END -->
