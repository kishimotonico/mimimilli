---
id: DRAFT-9
title: DLsite連携状態モデルの導入（rjCode・status・エラーの永続化）
status: Draft
assignee: []
created_date: '2026-07-10 10:29'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
作品ごとにDLsite連携の状態を .meta.json と SQLite の両方に持たせる。全DLsite改修の土台。

## 背景
現状は「DLsite情報を取得したか」がどこにも記録されず、urls に dlsite.com が含まれるかで間接的に分かる程度。未連携・取得失敗・RJコード誤検出を区別できないため、UIでの可視化も一括処理のスキップ判定もできない。

## 検討中の形
dlsite: {
  rjCode: string | null,        // 検出済みコード。手動上書き可能にする
  status: none | pending | fetched | applied | not_found | error,
  fetchedAt: string | null,     // 最終取得日時
  error: string | null          // 失敗理由（HTTP 404 等）
}

## 論点（要件決めで詰める）
- .meta.json のスキーマ変更とマイグレーション方針（既存メタとの互換）
- not_found（実在しない/販売終了）と error（一時的失敗）の区別
- 「RJコードはあるが連携しない」というユーザー意思（skip）を状態に含めるか
- スマートフォルダー条件（未連携のみ抽出等）への露出
- ユーザーが削除したタグの復活防止: mergeDlsiteTags は「存在しなければ追加」のため、ユーザーが削除したタグが再取得・再適用で復活する。最後に適用した info のスナップショットを持って差分適用するか、除外タグリストを持つか（ADR-0005 の決定7）

## 関連
- server/src/adapters/real/dlsite.ts（detectRjCode / fetchDlsiteInfo / mergeDlsiteTags）
- shared/src/dlsite.ts（契約）
- docs/requirements-v4.md §4.4
- docs/adr/0005-tags-as-sole-attribute.md、DRAFT-19（タグ設定・prefix定義）
<!-- SECTION:DESCRIPTION:END -->
