---
id: TASK-300
title: Playlist/Track ID所有権の移動でスキャンが主キー制約違反で中断するのを防ぐ
status: To Do
assignee: []
created_date: '2026-08-10 19:29'
labels: []
dependencies: []
priority: high
ordinal: 310000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
重複ID修復でPlaylist/Track IDの所有権が作品Xから作品Yへ移るとき、DBに残ったXの子行とYの挿入が衝突し、スキャンジョブ全体が主キー制約違反で中断する。TASK-289の実装中にCursorが挙げ、Codexレビューで裏取りした問題。master時点から存在する。

## 原因

catalogWorkRepository.ts の upsertWorkCatalog は、子行の削除を `where(catalogPlaylists.workId = work.id)` と自作品のworkId単位で行い、その後 catalogPlaylists.id / catalogTracks.id を主キーとして単純insertする。他作品が同じIDの行を握っている場合、その行は削除されないため衝突する。ScanUpsertBatch.flush は1トランザクション内でitemを順に処理するので、旧所有者の削除より新所有者の挿入が先に来ると発火する。

## 再現条件

1回目のスキャンで作品 b-old がPlaylist ID P・Track ID T で登録される。2回目のスキャンで、安定順（naturalCompare）で b-old より先行する作品 a-new が同じ P・T を持って現れる。修復により a-new が所有者となり b-old のメタは再採番されるが、登録順は a-new が先。b-old の旧 P・T 行がDBに残ったまま a-new が P をinsertして UNIQUE制約違反となり、スキャンジョブ全体が中断してfinalizeも走らない。外部編集がなくても発生する。

TASK-289で追加した「外部編集を検出したメタは登録せずerror扱いにする」経路は、markWorkError が works の status/errorMessage しか更新せず子行を残すため、発火条件をさらに増やす。TASK-289のAC「スキャンは継続・完了する」を実際には破りうる。

## 方針

upsertWorkCatalog の子行削除を、workId単位から「これから挿入するID集合」ベースへ広げ、他作品が握る同一IDの残骸も解放する。旧所有者は同一スキャン内で再登録されるか error 状態になる。ScanUpsertBatch側で削除フェーズを先出しする案は、error扱い・増分スキップで登録されない旧所有者のケースを救えないため不十分。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 安定順で先行する新規作品が既存作品のPlaylist/Track IDを引き継ぐ場合でも、スキャンが主キー制約違反で中断せず完了すること
- [ ] #2 旧所有者が外部編集検出でerror扱いとなり登録されない場合でも、新所有者の登録が主キー制約違反にならないこと
- [ ] #3 所有権移動後、DB上のPlaylist/Track行が新所有者の作品にのみ帰属し、旧所有者の残骸が残らないこと
- [ ] #4 上記が再現テストで担保されていること
<!-- AC:END -->
