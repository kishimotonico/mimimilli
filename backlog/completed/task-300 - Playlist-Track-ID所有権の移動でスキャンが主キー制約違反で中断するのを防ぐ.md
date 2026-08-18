---
id: TASK-300
title: Playlist/Track ID所有権の移動でスキャンが主キー制約違反で中断するのを防ぐ
status: Done
assignee: []
created_date: '2026-08-10 19:29'
updated_date: '2026-08-10 19:45'
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
- [x] #1 安定順で先行する新規作品が既存作品のPlaylist/Track IDを引き継ぐ場合でも、スキャンが主キー制約違反で中断せず完了すること
- [x] #2 旧所有者が外部編集検出でerror扱いとなり登録されない場合でも、新所有者の登録が主キー制約違反にならないこと
- [x] #3 所有権移動後、DB上のPlaylist/Track行が新所有者の作品にのみ帰属し、旧所有者の残骸が残らないこと
- [x] #4 上記が再現テストで担保されていること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
設計レビュー（2026-08-11、Fable＋Codex相談）: 方針は現案（upsertWorkCatalogで挿入予定ID集合と衝突する行を解放）で確定。補強点:
- 自作品のworkId単位削除を置き換えるのではなく、それに加えて挿入予定Playlist/Track IDと衝突する他作品の行を削除する
- 子行のinsertは単純insertのまま維持する（onConflictDoUpdateにしない）。修復をすり抜けた重複IDをPK制約違反として検出でき、ADR-0008「ライブラリ全体で一意」の監視役になるため
- catalogスキーマはtracks→playlistsにonDelete: cascadeあり（catalogSchema.ts:72）。Playlist削除でTrackは連鎖削除される。ADRのcascade禁止はDB間のみ
- 却下した代替案: onConflictDoUpdate付け替え（旧Track残骸とworkId食い違いが残る）、バッチ先頭の一括削除フェーズ（整合性の責務がScanUpsertBatchへ漏れる）、子テーブル全再構築（過大）
着手時期: 一度発火するとスキャンが毎回中断する恒久故障のため、機能開発より先に対応する

実装: upsertWorkCatalog で workId 単位削除に加え、挿入予定の Playlist/Track ID 集合と衝突する行を inArray（500件チャンク）で削除。子行の insert は単純 insert のまま維持。検証: 新規テスト server/tests/real/scanCatalogIdConflict.test.ts の2件が修正前は UNIQUE constraint failed: playlists.id で落ち、修正後は通ることを負のコントロールで確認。pnpm check && pnpm test は server 553 pass / client 794 pass。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
upsertWorkCatalog の子行削除を、自作品の workId 単位に加えて「挿入予定の Playlist/Track ID と衝突する他作品の行」まで広げ、所有権移動時の主キー制約違反によるスキャン中断を解消した。所有権移動と外部編集error残骸の2ケースを再現テストで担保。
<!-- SECTION:FINAL_SUMMARY:END -->
