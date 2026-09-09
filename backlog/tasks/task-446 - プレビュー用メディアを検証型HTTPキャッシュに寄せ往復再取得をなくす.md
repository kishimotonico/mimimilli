---
id: TASK-446
title: プレビュー用メディアを検証型HTTPキャッシュに寄せ往復再取得をなくす
status: To Do
assignee: []
created_date: '2026-09-09 16:26'
labels:
  - ui
  - files
  - performance
dependencies: []
priority: medium
ordinal: 467000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-436（値一覧・ファイル行のキーボード操作）の検証中に実測で判明した既存の穴。436 が持ち込んだものではない。

## 実測（TASK-436 の担当が agent-browser のネットワークログで確認）

Files のプレビューを矢印キーで A→B→A と往復したとき:

- 画像・動画（img/video タグ）: ブラウザHTTPキャッシュで処理され再取得なし
- テキスト・PDF: 往復のたびに再取得が発生する

原因は FilePreview.tsx で TanStack Query を使っているのが singleFileWorkQuery（単一ファイル作品の詳細）だけで、メディア本体が対象外になっていること。テキストは TextMedia.tsx の素の fetch、PDF はブラウザ内蔵ビューアへの Document ナビゲーション。

TASK-436 で矢印キー移動を入れたことにより、この既存挙動を踏む頻度は上がった（連打しやすくなったため）。ただし debounce のような個別対処は入れない方針（作品一覧と同じ性質なので files だけ挙動が割れる）。

## 方針（オーナー決定 2026-09-10）

個別の debounce ではなく、配信側と取得側の両方を揃える。

1. プレビュー用メディア配信 GET /media/workspace にサーバー側で ETag / Last-Modified と Cache-Control: no-cache（検証付き再利用）を付ける。**ファイルは変更されうるので immutable ではなく検証型**にすること。これで画像・動画・テキスト・PDF を同じ仕組みで往復再取得ゼロにする
2. クライアントの TextMedia の素の fetch は entities/file-system の queryKeys 経由の useQuery へ寄せ、メモリキャッシュも作品側と揃える
3. PDF はブラウザ内蔵ビューアへの Document ナビゲーションなので、**HTTP 検証キャッシュだけが効く経路**である（クライアント側のメモリキャッシュは効かない）

関連: TASK-436（連続再取得はこのタスクで対応する）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 同じテキスト・PDF・画像を矢印キーで往復してもネットワークが304か無通信になる（agent-browserのnetwork requestsで確認）
- [ ] #2 更新後のファイルは再取得される（検証型キャッシュとして機能している）
- [ ] #3 GET /media/workspace が ETag/Last-Modified と Cache-Control: no-cache を返す
- [ ] #4 TextMedia の取得が entities/file-system の queryKeys 経由の useQuery になっている
<!-- AC:END -->
