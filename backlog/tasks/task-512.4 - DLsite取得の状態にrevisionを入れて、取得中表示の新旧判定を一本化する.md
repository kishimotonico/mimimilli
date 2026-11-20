---
id: TASK-512.4
title: DLsite取得の状態にrevisionを入れて、取得中表示の新旧判定を一本化する
status: Done
assignee: []
created_date: '2026-11-19 15:00'
updated_date: '2026-11-19 18:04'
labels: []
dependencies: []
parent_task_id: TASK-512
ordinal: 586000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-512.2の事例4・5・6は、DLsite取得の状態にもスキャン候補GETの応答にも新旧を判定する値が無いため、HTTP応答とSSEのどちらが新しいかをクライアントが推測するフラグ群で塞いでいた。コード単位の取得状態に単調増加のrevisionを持たせ、SSEの終端イベントと候補GETの応答の両方に載せ、クライアントは「revisionが大きい方を採る」規則ひとつで表示を決める。採らないもの: SSEの常設チャネル化（別タブで始めたジョブを追う要件がない）、ジョブストアの状態機械としての全面書き直し。ジョブストアはrevision導入後に残る部分だけ整理する。applySnapshotで終端を知ったときの単発取得の作品無効化漏れと、事例6のストアテストの状態（fetchingにする）もここで扱う。設計の根拠は tmp/task-512/review/state-concurrency.md のS1・S2、architecture.md の指摘3、tmp/task-512/advisor-decisions.md の3。 あわせて、スキャン完了直後にRJコードを直したとき実行中の候補GETに値が戻される問題も直す（replaceScanCandidate が実行中のGETを打ち切らない。3秒の間引きとマウント時の再同期が消えると自然には直らなくなるため）。refreshScanCandidates の「打ち切られた側は最新の取得を待つ」待ち合わせは、512.3の登録後のbusyが頼るので残す。revisionはadapterでなくサーバー層で付け、読むのは候補の集約を呼ぶ前・付けるのは後にする（キャッシュを読んだ後に終わった取得が古い中身のまま勝たないように）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 コード単位のDLsite取得状態が単調増加のrevisionを持ち、SSEの終端イベントと候補GETの応答の両方に載っている
- [x] #2 クライアントの候補の取得中表示が、revisionの大小比較だけで新旧を決めている
- [x] #3 再接続スナップショットで単発取得の終端を知った場合も、その作品の表示が新しくなる（テストで固定）
- [x] #4 事例4・5・6の再現シナリオ（取得中に切断・HTTP応答とSSEの追い越し・ジョブ切替）が、revisionを外すと落ちるテストで固定されている
- [x] #5 check・test・smoke が通る
- [x] #6 settled・markSettled・codeSeenAt・lost・UnregisteredTabのマウント時の再同期・DLSITE_CANDIDATES_REFRESH_INTERVAL_MSが消えている（rgで0件）。epoch・generation・trackedJobIdは不要な重なりが消え、残すものは理由を最終サマリーに書く
- [x] #7 スキャン完了直後にRJコードを直しても、実行中の候補GETで値が戻らない（テストで固定）
- [x] #8 新ADRがADR-0030の「generationを共通に使う」とADR-0033の該当箇所を置き換え、「再生用の連番を持たないことと新旧判定用のrevisionを持つことは別」と新旧判定の方式を書いている
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
DlsiteJobManager がプロセス全体で単調に増える revision（max(前回+1, 現在時刻のマイクロ秒)）を持ち、見える変化のたびに進める。SSE・照会・POST の応答は {revision, job}、終端のコードは候補と同じ導出の結果 DlsiteProductSummary を持ち、スキャン候補は集約の前に読んだ revision を dlsiteRevision として持つ。クライアントは commit で revision が進んだ状態だけを取り込み、表示は「結果の revision が候補より大きいときだけ結果を採る」規則ひとつで決める。作品の無効化は commit の差（codesSettled・jobEnded）から DlsiteJobRuntime の1か所で行い、初回の取り込みでは通知しない。消したもの: settled・markSettled・codeSeenAt・lost・3秒の間引き・未登録タブのマウント時の再同期・DLsite の generation と trackedJobId・replaceScanCandidate。残したもの: epoch（reset はクライアントが状態を捨てる境界で revision では表せない）、emptyReopens（接続をあきらめる方針で新旧判定と無関係）、refreshScanCandidates の待ち合わせ（登録後の busy と RJコードの差し替えが頼る。データがある状態で打ち切られた取得も最新を待つよう直した）、候補クエリの enabled:false（候補の取得をすべて打ち切り＋待ち合わせに通すため）。スキャン完了直後に直したRJコードは、打ち切り→差し替え→取り直しで戻らない。想定外の例外とオフラインで failed になったコードは、次の候補GETでキャッシュの状態に戻る（許容）。時計が戻った状態で再起動すると、ページを読み直すまで取得中の表示と無効化が止まる（ADR-0038 に記載）。ADR-0038 を追加。
<!-- SECTION:FINAL_SUMMARY:END -->
