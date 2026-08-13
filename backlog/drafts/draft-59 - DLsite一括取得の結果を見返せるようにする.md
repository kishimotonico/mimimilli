---
id: DRAFT-59
title: DLsite一括取得の結果を見返せるようにする
status: Draft
assignee: []
created_date: '2026-08-13 17:00'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー2026-08-14の積み残し。数百件の一括取得で何件が成功したのかが分かりにくいという課題。現状: 実行中はTopBarに「DLsiteから取得中 (n/total) — 作品名」が出るが（TASK-293で改善済み）、完了結果はトーストで「取得 N件・失敗 M件（うちパース K件）」が出て消えるだけで見返せない。さらにAPIが返すのは合計値（fetched/failed/parseErrors/skipped）のみで、失敗理由の内訳（not_found・offline・error等のDlsiteFetchErrorKind）も失敗した作品のリストも取得できないため、UIをどう作っても件数以上の情報を出せない。

決めること: (1) 一括取得結果APIに失敗内訳と対象Work IDを持たせるか (2) 結果を見返す置き場所（ライブラリのエラービュー拡張／DLsite専用の結果画面／通知ベルの展開） (3) 個別再取得の導線。

前提: TASK-321（DLsite取得statusの投影経路を再設計し通知集計を復旧する）を先に片付けないと、通知ベルの取得失敗件数が常に0のままでどんなUIを作っても数字が出ない。関連: DRAFT-31（一括refreshをUIから使えるようにするか）。スキャンモーダルへの統合はしない方針（DLsite取得はスキャン以外からも走るため。要対応タブにはまとめ行のみ置く）。
<!-- SECTION:DESCRIPTION:END -->
