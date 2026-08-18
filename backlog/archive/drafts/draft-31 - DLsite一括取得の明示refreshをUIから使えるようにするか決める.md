---
id: DRAFT-31
title: DLsite一括取得の明示refreshをUIから使えるようにするか決める
status: Draft
assignee: []
created_date: '2026-07-26 02:02'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 背景

TASK-93.2 で `runDlsiteBulk` に「applied済みの作品もキャッシュTTLに従って取り直す」明示refreshの機構を `includeApplied` オプションとして入れたが、`DataAdapter` インターフェースに定義がなくHTTP経由で到達できなかったため、2026-07-25 の点検で削除した。

現在ある強制再取得の手段は次のみ。

- `POST /dlsite/:id/fetch?force=true` — 作品1件単位、キャッシュを無視して取り直す

一括の再取得手段はない。通常の一括取得は `applied` と `skipped` を対象外にする（未適用を埋める動作）。

## 決めたいこと

一括での明示refreshが必要かどうか。

必要なら、次を決める必要がある。

- どの画面のどの操作から呼ぶか
- 対象範囲（全作品か、選択した作品か、特定の分類軸配下か）
- キャッシュTTLに従うのか、キャッシュを無視して取り直すのか。後者の場合、作品数ぶんの実HTTPが発生するのでレート制限との兼ね合いをどう見せるか（進捗・所要時間の目安）
- 既存のタグ・タイトルへの再適用をどう扱うか（`mode` の "new" / "existing" との関係）

不要なら、作品単位の force で十分という判断を記録して閉じる。

## 補足

TTLが切れた作品は通常の一括取得でも自然に取り直されるため、「古い情報を更新したい」という目的だけなら明示refreshがなくても時間経過で解決する。急いで更新したい場面が実際にあるかどうかが判断の分かれ目。
<!-- SECTION:DESCRIPTION:END -->
