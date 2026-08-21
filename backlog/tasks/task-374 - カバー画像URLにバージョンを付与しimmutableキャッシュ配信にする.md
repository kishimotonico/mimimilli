---
id: TASK-374
title: カバー画像URLにバージョンを付与しimmutableキャッシュ配信にする
status: Done
assignee: []
created_date: '2026-08-21 12:49'
updated_date: '2026-08-21 13:11'
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
- [x] #1 coverSchema に version が追加され、real/fixture 両アダプタのDTOに設定されている（両アダプタを通す契約テストあり）
- [x] #2 カバー画像URLに v= が付与され、v付きリクエストへのレスポンスが Cache-Control: private, max-age=31536000, immutable になっている（テストとpreview実測で確認）
- [x] #3 v無しリクエストは従来の must-revalidate + ETag/304 挙動を維持している
- [x] #4 preview環境で一覧→リロード時にカバー画像のネットワークリクエストが発生しない（ブラウザ実測）
- [x] #5 カバー元ファイルを差し替えると version とURLが変わり、新画像が取得される意味論がテストで保証されている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
shared/coverValueSchemaにversion追加。realはcoverDtoFromColumns(stat)、fixtureはfixtureCoverFromColumns(synthetic SVG size+mtimeMs=0)。server/tests/coverVersionContract.test.tsで両アダプタのgetWork経由を検証。

getCoverImageUrl(workId,version,width)が?v=付与。server/tests/coverVersionContract.test.tsでv付きCache-Control: private,max-age=31536000,immutableをreal/fixtureルートで検証。preview実測は委譲元。

v無しはmust-revalidate維持。coverVersionContract.test.tsの「v無しはETag一致で304、v付きは304にしない」およびfixtureMedia既存ETagテストで検証。

real: tmpライブラリでcover.jpg差し替え→version/ETag変化をcoverVersionContract.test.tsで検証。fixture: タイトル変更でSVG内容変化→version変化を同テストで検証。負の検証: deriveCoverVersion定数化でreal差し替えテスト失敗、v付きCache-Control破壊でimmutableテスト3件失敗を確認後復元。

AC#4根拠: 統合検証（preview fixture large）で、カバーURLに v=<hash> が付与され cache-control: private, max-age=31536000, immutable を実測。リロード後はResource Timingで16件全カバーが transferSize: 0（キャッシュヒット、サーバー再リクエストなし）。v無しURLの304挙動もルートテストで維持確認。

レビュー指摘対応: DBにカバーありで実ファイル欠損の場合にthrowせずcover: nullへ投影（一覧500の退行を回避、負の検証済み）。検証指摘対応: coverLabel/coverThumbnailWidthのユニットテスト2件をv=付きURLへ追随。/assets直下の .br 直叩きURLが素のバイナリで返る件は、そのURLを叩くクライアントが存在しないため対応なし。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
coverSchemaにversion（size+mtimeMs由来のopaqueハッシュ）を追加し、real/fixture両アダプタでDTOに付与。カバーURLは v= 必須となり、v付きはimmutable・v無しは従来のmust-revalidate+304。欠損ファイルはcover: null投影。契約テスト・ルートテスト・ブラウザ実測（リロードでリクエスト0）で検証。
<!-- SECTION:FINAL_SUMMARY:END -->
