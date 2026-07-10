---
id: DRAFT-10
title: DLsite手動取得UI（WorkDetailからfetch→プレビュー→選択適用）
status: Draft
assignee: []
created_date: '2026-07-10 10:29'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
WorkDetail に「DLsiteから取得」ボタンと適用プレビューダイアログを追加し、既存の POST /dlsite/:id/fetch → apply を初めてUIに配線する。

## 背景
サーバーAPI（fetch/apply の2段階）とクライアントのAPI関数（client/src/entities/work/api.ts の fetchDlsiteInfo / applyDlsiteInfo）は実装済みだが、呼び出すUIが存在せずエンドツーエンドで未配線。ユーザーからは「何も起きない」ように見える。

## 検討中のUI
- WorkDetail にボタン → fetch 結果を現在値と並べた diff プレビュー
- タイトル / タグ / カバーをチェックボックスで選択適用（契約 applyTitle/applyTags/applyCover をそのまま使う）
- RJコードの手動修正: フォルダー名から誤検出した場合にダイアログでコードを打ち直して再取得できる
- 失敗時のフィードバック: 404（実在しない・販売終了・コード違い）と通信エラーを区別したメッセージ。「RJコードが違うかも」への導線
- RJコード未検出の作品ではボタンの表示をどうするか（コード入力から始める導線）

## 依存・関連
- DRAFT-9（連携状態モデル）が先にあると状態表示まで込みでできるが、なくても最小配線は可能
- 手動修正したRJコードの保存先は DRAFT-9 の dlsite.rjCode を想定
- docs/design-system.md のダイアログ・トースト規約に従う
<!-- SECTION:DESCRIPTION:END -->
