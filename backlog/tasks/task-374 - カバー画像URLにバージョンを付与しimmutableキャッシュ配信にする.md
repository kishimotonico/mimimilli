---
id: TASK-374
title: カバー画像URLにバージョンを付与しimmutableキャッシュ配信にする
status: To Do
assignee: []
created_date: '2026-08-21 12:49'
labels: []
dependencies: []
ordinal: 374000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
カバー画像は現状URL固定＋Cache-Control: private, max-age=0, must-revalidate のため、一覧を開くたびに枚数分の304再検証RTTが発生し、高RTT環境で体感を悪化させる。URLにコンテンツバージョンを含めてimmutable化し、再訪時のリクエストをゼロにする。

設計:
- shared の coverSchema に version: string（opaque、カバー内容が変わると必ず変わる短いハッシュ）を追加する。サーバーは既存のETag生成（server/src/adapter/media.ts createCoverValidators、size+mtimeMs由来）と同じ材料から算出する。real/fixture両アダプタでDTOに設定する
- client の getCoverImageUrl（client/src/entities/work/api.ts）を version 必須の引数構成に変え、URLへ v= クエリを付ける。呼び出し元（CoverImg等）を追随させる
- サーバー /media/cover/:id は v クエリ付きリクエストに Cache-Control: private, max-age=31536000, immutable を返す（vはキャッシュバスターとして扱い、内容は常に現行版を返す）。v無しは従来の must-revalidate を維持
- 後方互換レイヤーは作らない（DTO契約の破壊的変更でよい）
- 契約検証: 「versionはカバー内容が変わると変わり、変わらなければ安定」という意味論を、real/fixture両アダプタを実際に通すテストで縛る（モック境界の手前でモックしない）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 coverSchema に version が追加され、real/fixture 両アダプタのDTOに設定されている（両アダプタを通す契約テストあり）
- [ ] #2 カバー画像URLに v= が付与され、v付きリクエストへのレスポンスが Cache-Control: private, max-age=31536000, immutable になっている（テストとpreview実測で確認）
- [ ] #3 v無しリクエストは従来の must-revalidate + ETag/304 挙動を維持している
- [ ] #4 preview環境で一覧→リロード時にカバー画像のネットワークリクエストが発生しない（ブラウザ実測）
- [ ] #5 カバー元ファイルを差し替えると version とURLが変わり、新画像が取得される意味論がテストで保証されている
<!-- AC:END -->
