---
id: TASK-326
title: スキャンモーダルを左リスト構成へ再編する
status: Done
assignee: []
created_date: '2026-08-13 16:58'
updated_date: '2026-08-14 07:44'
labels: []
dependencies:
  - TASK-324
  - TASK-325
priority: high
ordinal: 336000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー2026-08-14。現状は460px幅のモーダルに進行状況・ライブラリ件数・集計グリッド・警告・確認・新規作品一覧の6ブロックが縦積みで、典型ケースで合計940pxとなり必ず外側スクロールが発生する。さらに新規作品一覧が内部スクロールを持つため入れ子スクロールになる。骨格を作り直す。UI仕様: 幅を740pxへ拡大／左に幅148pxのリスト（未登録・要対応・新規登録済み・更新された作品の4項目、各行に件数バッジ。区切り線の下に「更新なし」「ライブラリ全体」の集計と「最終スキャン」＋日時を配置）／右にタブ内容／ScanWarningsコンポーネントは廃止し要対応タブへ統合（RJコード未検出・データ不整合を「N件の作品」のまとめ行として表示し「一覧を見る」でライブラリのエラービューへ遷移）／要対応テーブルの列は種類・対象・内容・操作。ID重複は競合する各パスを別行に分け片方に「競合相手」と注記（現状のpaths.join(" / ")連結をやめる）。デザインはdocs/design-system.md準拠。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 モーダルが740px幅になり、左リストで未登録・要対応・新規登録済み・更新された作品を切り替えられる
- [x] #2 左リストに各件数バッジと、集計（更新なし・ライブラリ全体）・最終スキャン日時が表示される
- [x] #3 ScanWarningsが廃止され、RJコード未検出とデータ不整合が要対応タブのまとめ行として表示される
- [x] #4 要対応テーブルでID重複の競合パスが別行に分かれて表示される
- [x] #5 典型ケース（未登録5件・新規10件・要対応5件）でモーダル内のスクロールが入れ子にならない
- [x] #6 TopBarのスキャンボタンに未登録件数のバッジが表示される
- [x] #7 pnpm test:smokeが通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
460pxの縦積み6ブロック構成を740px幅・左リスト+タブ構成へ作り直した。ScanWarnings・ScanReview・ScanNewWorks・StatsGrid・StatusRow・ScanFooterControlsを廃止し、タブ（未登録・要対応・新規登録済み・更新された作品）ごとのコンポーネントへ分割。左リストに件数バッジ・更新なし件数・ライブラリ全体件数・最終スキャン日時を表示。要対応タブはGET /api/scan/diagnosticsのライブ購読に切り替え、解決済みの問題が残り続ける不具合（TASK-322）を解消。TopBarのスキャンボタンに未登録件数バッジを追加。verified: 典型ケースでのスクロール確認、pnpm test:smoke。
<!-- SECTION:FINAL_SUMMARY:END -->
