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
- タイトル / タグ / カバーをチェックボックスで選択適用。ただし applyTags は boolean 1個で circle/cvs/genre 一括適用のため、タグ単位のチェックボックスに変えて契約もタグ単位選択へ変更することを検討（ADR-0005 の「ユーザーが取捨選択する」思想と整合）
- 誤適用のリカバリー: mergeDlsiteTags は追記のみで、RJコード修正→再取得しても誤適用済みタグは残る。再適用時に旧DLsite由来タグを差し替える挙動を検討（DRAFT-9 のスナップショット/除外リスト論点と関連）
- RJコードの手動修正: フォルダー名から誤検出した場合にダイアログでコードを打ち直して再取得できる
- 失敗時のフィードバック: 404（実在しない・販売終了・コード違い）と通信エラーを区別したメッセージ。「RJコードが違うかも」への導線
- RJコード未検出の作品ではボタンの表示をどうするか（コード入力から始める導線）

## 依存・関連
- DRAFT-9（連携状態モデル）が先にあると状態表示まで込みでできるが、なくても最小配線は可能
- 手動修正したRJコードの保存先は DRAFT-9 の dlsite.rjCode を想定
- docs/design-system.md のダイアログ・トースト規約に従う
- docs/adr/0005-tags-as-sole-attribute.md（タグ一元管理）、DRAFT-19（タグ設定・prefix定義）
<!-- SECTION:DESCRIPTION:END -->
