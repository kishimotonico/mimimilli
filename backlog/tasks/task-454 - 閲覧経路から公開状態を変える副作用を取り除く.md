---
id: TASK-454
title: 閲覧経路から公開状態を変える副作用を取り除く
status: Done
assignee: []
created_date: '2026-09-21 10:48'
updated_date: '2026-09-23 22:17'
labels: []
dependencies: []
documentation:
  - docs/adr/0025-source-mutation-projection-read-separation.md
ordinal: 508000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0025 の「閲覧」契約。getWork の readMetaSource、resolveWorkWithLiveProbe、syncTotalDurationSec を通常閲覧から外す。詳細を開くだけで一覧の時間ソートや smart folder の所属が変わる隠れた契機をなくす。GET が呼ぶ別 helper へ移すだけでは責務は分離しない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 作品詳細のGETが catalog の公開値を変更しない
- [x] #2 probe cache のメモ化など内部キャッシュへの書込みと、公開済み catalog 値の変更が区別されている
- [x] #3 一覧・詳細がメタデータを catalog 投影から、bookmark/resume を user 状態から読む
- [x] #4 総時間の更新契機が scan・再生準備などから選定され、更新後に track 解決結果・総時間・関連する一覧が整合して観測できる
- [x] #5 probe 能力が再生準備と明示的なメディア再確認として残っている。新しい再確認UIの追加は必須としない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
getWork から sourceRevision 付与を外す変更は TASK-452 が所有する。このタスクは live probe と公開値更新の分離を担当する。

実測: getWorkWithLiveProbe は getWork / 登録・復元応答 / identity再採番 / dlsiteFetch / テストヘルパ。syncTotalDurationSec は resolveWorkWithLiveProbe のみ。locateMedia は probe しない。設計: scratchpad/design-TASK-454.md

決定: GET /works/:id は catalog 投影+user 状態のみ（live probe・syncTotalDurationSec・probe cache 書込みなし。トラック duration は cache 読取、無ければ unprobed）。総時間の公開は scan/単作品投影と POST /api/works/:id/playback-preparation（prepareWorkPlayback = getWorkWithLiveProbe）。明示的な再確認は既存スキャン。独立 live observation エンドポイントは作らない。登録/復元/別作品化/dlsiteFetch の応答は catalog getWork。
<!-- SECTION:NOTES:END -->
