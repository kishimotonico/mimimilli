---
id: TASK-454
title: 閲覧経路から公開状態を変える副作用を取り除く
status: To Do
assignee: []
created_date: '2026-09-21 10:48'
updated_date: '2026-09-21 13:44'
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
- [ ] #1 作品詳細のGETが catalog の公開値を変更しない
- [ ] #2 probe cache のメモ化など内部キャッシュへの書込みと、公開済み catalog 値の変更が区別されている
- [ ] #3 一覧・詳細がメタデータを catalog 投影から、bookmark/resume を user 状態から読む
- [ ] #4 総時間の更新契機が scan・再生準備などから選定され、更新後に track 解決結果・総時間・関連する一覧が整合して観測できる
- [ ] #5 probe 能力が再生準備と明示的なメディア再確認として残っている。新しい再確認UIの追加は必須としない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
getWork から sourceRevision 付与を外す変更は TASK-452 が所有する。このタスクは live probe と公開値更新の分離を担当する。
<!-- SECTION:NOTES:END -->
