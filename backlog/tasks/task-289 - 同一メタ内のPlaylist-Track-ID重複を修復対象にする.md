---
id: TASK-289
title: 同一メタ内のPlaylist/Track ID重複を修復対象にする
status: To Do
assignee: []
created_date: '2026-08-09 20:44'
labels: []
dependencies: []
priority: high
ordinal: 299000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スキャン時の重複ID修復（ADR-0008）が、同一の mimimilli.json 内でのID重複を検出できない。

server/src/adapters/real/duplicateMetaIdRepair.ts の repairDuplicates は、保持した既存Playlist/Track IDをループ中に seenIds へ追加せず、registerSeenIds はメタ全体の処理後にしか走らない。そのため同じメタ内で2つのPlaylist（またはTrack）が同じIDを持つ場合、後続の重複を検出できず、重複したままcatalogへ挿入されて主キー制約でスキャン全体が失敗する。ADR-0008の「ライブラリ全体で一意」という不変条件に反する。メタ間の重複は正しく検出できており、抜けているのは同一メタ内のみ。

あわせて外部編集検出時の登録方針も決める。scanRegister.ts の prepareMetaEntries は、修復中に外部編集を検出したメタも修復スキップのまま通常の ok エントリとして登録を続行する。ADR-0008の文言は『修復をスキップする』であり登録スキップまでは求めていないが、Work ID重複が未修復のまま登録されると後続のupsertが先の作品を一時的に上書きしうる。当該スキャンで登録もスキップするか、現状維持とするかを決めてADR-0008へ明文化する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 同一メタ内でPlaylist IDが重複した場合、後続要素が再採番されること
- [ ] #2 同一メタ内でTrack IDが重複した場合、後続要素が再採番されること
- [ ] #3 上記が再現テストで担保されていること
- [ ] #4 外部編集検出時の登録方針が決定され、ADR-0008に明文化されていること
<!-- AC:END -->
