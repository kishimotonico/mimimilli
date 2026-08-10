---
id: TASK-289
title: 同一メタ内のPlaylist/Track ID重複を修復対象にする
status: Done
assignee: []
created_date: '2026-08-09 20:44'
updated_date: '2026-08-10 19:24'
labels: []
dependencies: []
priority: high
ordinal: 299000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スキャン時の重複ID修復（ADR-0008）に2つの穴がある。(1) 同一の mimimilli.json 内でのID重複を検出できない。(2) 外部編集検出時に重複IDを抱えたまま登録を続行する。

## (1) 同一メタ内のID重複

duplicateMetaIdRepair.ts の repairDuplicates は、保持した既存Playlist/Track IDをループ中に seenIds へ追加せず、registerSeenIds はメタ全体の処理後にしか走らない。そのため同じメタ内で2つのPlaylist（またはTrack）が同じIDを持つ場合、後続の重複を検出できない。メタ間の重複は正しく検出できており、抜けているのは同一メタ内のみ。

## (2) 外部編集検出時の登録方針（決定済み: error扱いで登録スキップ）

前提となるユースケース: mimimilli.json は外部ツールでの編集を一級のワークフローとして想定しており、編集結果は再スキャンボタンで反映する。外部編集検出（修復判定時の本文と書込み直前の本文の不一致）が発動するのはスキャン実行中にファイルが変わったレース時のみで、通常の「編集してから再スキャン」フローでは発動しない。

現状の問題（コード調査で確認済み）:
- prepareMetaEntries（scanRegister.ts:157-237）は外部編集検出パスを scanLogger.warn に書くだけで、ScanResult にもUIにも出さず、重複IDを抱えたまま kind: ok で登録を続行する
- registerPhase は idsAlreadyRegistered: true を常に渡す（scanner.ts:225）ため、assertUniqueMetaIds による一意性チェックが働かない
- Work ID重複のまま登録: upsertWorkCatalog が onConflictDoUpdate のため後勝ちのsilent上書き。片方のフォルダーのカタログデータがDB上から黙って消える（メタファイル自体は残るため次回スキャンで自己回復はする）
- Playlist/Track IDだけが重複のまま登録: 単純insertのため主キー制約違反がthrowされ、どのtry/catchにも拾われずスキャンジョブ全体がエラー中断。finalizeも走らない

決定: 外部編集を検出したメタは当該スキャンでは登録せず、既存のerror経路（handleMetaParseError → markWorkError）に乗せて作品をerror状態にし、スキャンは継続する。編集途中の中途半端な内容を登録しない・確信が持てないものは保留するというADR-0008の思想に沿い、ユーザーには再スキャンで解消できる形で見せる。この決定をADR-0008の「外部編集との競合」節へ明文化する。

実装の核心: 外部編集でスキップされたメタの集合を registerPhase へ伝え、該当メタを登録対象から外してerror経路へ流す（idsAlreadyRegistered: true の固定をやめて一意性チェックを働かせる方法でも可）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 同一メタ内でPlaylist IDが重複した場合、後続要素が再採番され、defaultPlaylistIdは先に現れた要素を指し続けること
- [x] #2 同一メタ内でTrack IDが重複した場合（同一Playlist内・異なるPlaylist間の両方）、後続要素が再採番されること
- [x] #3 外部編集を検出したメタが当該スキャンで登録されず、既存作品はerror状態になり、新規作品はScanResultのエラーとして計上され、スキャン自体は継続・完了すること
- [x] #4 外部編集検出後の次回スキャンで該当メタが再評価され、重複が残っていれば修復のうえ登録、解消済みならそのまま登録されること
- [x] #5 上記すべて（同一メタ内重複・外部編集時の登録スキップと回復）が再現テストで担保されていること
- [x] #6 登録スキップの決定がADR-0008の「外部編集との競合」節に明文化されていること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codexレビュー（2026-08-11）で採用した実装上の注意:
- 登録スキップ（外部編集・スキーマ不正）で確定しなかったIDを seenIds へ持ち込まないこと。汚染すると後続の正常なメタが誤って再採番される
- 外部編集検出は2つの競合タイミングがある（修復判定後の再読込み時と、一時ファイル作成後・rename直前の再確認時。duplicateMetaIdRepair.ts:135付近）。再現テストは両方をカバーする
- 重複Playlist IDをdefaultPlaylistIdが指す場合、現行実装は一致するPlaylistごとに参照を更新するため後続要素へdefaultが移りうる。ADR-0008「先に現れた要素が所有」に合わせること（AC#1に対応）

検証: pnpm check 成功、pnpm test 795 pass / 0 fail、server/tests/real/duplicateMetaIdRepair.test.ts 15 pass。Codexレビュー2周（1周目のdefaultPlaylistId所有指摘を修正、2周目は指摘なし）。

未解決の別問題（TASK-289のスコープ外・master時点から存在）: Playlist/Track IDの所有権が作品Xから作品Yへ移るとき、upsertWorkCatalog の子行削除が workId 単位のため、Xの旧行が残ったままYが同じIDをinsertして playlists.id のUNIQUE制約に当たりスキャンジョブ全体が中断しうる。外部編集をerror扱いにする本変更は markWorkError が子行を残すぶん発火条件を増やす。再現例: 1回目に b-old をPlaylist ID Pで登録、2回目に辞書順で先行する a-new が同じPを持って現れると、登録順が a-new → b-old のため a-new のinsertで衝突する（外部編集なしでも発生）。修正方針は upsertWorkCatalog の子行削除を挿入予定のID集合ベースへ広げること。別タスクとして起票する（並行セッションのタスク番号衝突を避けるため起票は保留中）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
repairDuplicates にメタ内ローカルのIDセットを導入し、同一 mimimilli.json 内のPlaylist/Track ID重複でも後続要素を再採番するようにした。defaultPlaylistId は先に現れたPlaylistが所有し続ける（Work ID既出の分岐も同様）。重複ID修復中に外部編集を検出したメタは当該スキャンで登録せず MetaParseError として既存のerror経路へ流し、既存作品はerror状態・新規作品はスキャン結果のエラー計上としつつスキャンは継続する。ADR-0008の「外部編集との競合」節に明文化。検証は pnpm check 成功・pnpm test 795 pass、対象テスト15 pass、Codexレビュー2周で指摘なし。
<!-- SECTION:FINAL_SUMMARY:END -->
