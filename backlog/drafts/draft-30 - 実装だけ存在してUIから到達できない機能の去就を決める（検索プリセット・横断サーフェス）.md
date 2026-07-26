---
id: DRAFT-30
title: 実装だけ存在してUIから到達できない機能の去就を決める（検索プリセット・横断サーフェス）
status: Draft
assignee: []
created_date: '2026-07-26 02:02'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 背景

2026-07-25 のオーバーエンジニアリング点検で、実装されているのにUIから使えない機能が2つ見つかった。今回は削除せず残す判断をしたが、去就が未決のままなので方針を決めたい。

### 検索プリセット

`server/src/routes/presets.ts`（105行）、`workRepo` の `listPresets` / `createPreset` / `deletePreset`、`search_presets` テーブル、`shared/src/library.ts` のZodスキーマ、real/fixture両実装、HTTPルート3本がフル実装済み。

一方 `client/src` からは一度も呼ばれていない（`features/library/model/types.ts` で型を再エクスポートしているだけで、API呼び出しもUIも存在しない）。`docs/requirements-v4.md` に「プリセット」という語は一度も出てこない。7.4節で言及されるのはスマートフォルダーのみ。

### 横断サーフェス（再生中・履歴・お気に入り・ピン留め）

`client/src/app/ui/LeftNav.tsx` の `SURFACES` が `disabled` かつ `title="近日実装"` でレンダリングされ、クリックできない。`playingCount` を算出して渡す配線まであるが、ボタンが押せないためbadgeが表示されることはない。

要件7.2は「横断サーフェスの存在」を求めているが機能実装までは要求していない。

## 決めたいこと

それぞれについて次のどれかを選ぶ。

- 使う: いつ・どの画面から使うかを決めて、フロントを実装するタスクを切る
- 使わない: バックエンド・UIごと削除する
- 保留を続ける: 保留する理由と、次に見直す条件（時期・きっかけ）を明記する

「なんとなく残す」を続けると、要件文書に存在しない実装を保守し続けることになる。特に検索プリセットはDBテーブルとAPI契約を含むため、スマートフォルダーと役割が重複していないかの整理も必要。

## 参考

- スマートフォルダーとの機能重複の有無
- 横断サーフェスは「お気に入り」「ピン留め」というマーキング機能に依存する。関連ドラフトあり
<!-- SECTION:DESCRIPTION:END -->
