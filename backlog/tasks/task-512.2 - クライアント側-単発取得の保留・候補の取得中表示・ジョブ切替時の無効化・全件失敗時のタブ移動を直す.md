---
id: TASK-512.2
title: 'クライアント側: 単発取得の保留・候補の取得中表示・ジョブ切替時の無効化・全件失敗時のタブ移動を直す'
status: Done
assignee: []
created_date: '2026-11-19 09:38'
updated_date: '2026-11-19 10:05'
labels: []
dependencies: []
parent_task_id: TASK-512
ordinal: 584000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexレビュー事例4・5・6・9（tmp/task-511-review/result.md）。
事例4: 単発取得の完了イベントがPOST応答より先に届くと、保留（pendingSingles）が外れず行が取得中のまま残る（dlsiteJobStore.ts）。POST中にそのコードの非終端イベント（queued/fetching）を受けていれば、応答時点で終端でも保留を外す（サーバーのadmitは応答前に非終端イベントを同期で送出する）。
事例5: サーバーの withInFlightDlsite が候補GETにジョブの進行状態をfetchingとして混ぜ、DlsiteJobRuntimeは候補GETの成否にかかわらずmarkSettledする。最後の再取得が失敗すると行が取得中で固まり追加もできない。サーバーの重ね合わせ（withInFlightDlsite・dlsiteInFlightStateの配線）を消して候補GETはキャッシュ由来の状態だけ返し、進行状態はジョブのsnapshotとSSEだけが持つ。markSettledはジョブ終了後の候補GETが成功してキャッシュへ反映できたときだけ呼ぶ（キャンセル時は後続の結果を待つ）。
事例6: SSE切断中にジョブが入れ替わると、finishedのproductCodesが最後に受け取った終端コードだけになり、作品詳細・一覧の無効化が漏れる。finishedのproductCodesをそのジョブで追跡していた全コードにする。
事例9: 項目ごとの失敗だけで全件失敗しても新規作品タブへ移り、失敗理由が消える（UnregisteredTab.tsx、ScanModal.tsx）。失敗0件かつ中断なしのときだけ新規作品タブへ移り、失敗があれば未登録タブにとどまって理由を見せる。トーストの文言もこれに合わせる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 単発取得の完了イベントがPOST応答より先に届いても保留が外れることをストアのテストで確認している
- [x] #2 候補GETがジョブの進行状態を含まず、進行中の表示はジョブの状態だけから出ている
- [x] #3 ジョブ終了後の候補再取得が失敗・キャンセルされたときは同期済みにせず、行が取得中で固まらないことをテストで確認している
- [x] #4 SSE切断中にジョブが入れ替わっても、旧ジョブで扱ったコードの作品キャッシュが無効化されることをテストで確認している
- [x] #5 登録で失敗が1件でもあれば未登録タブにとどまり失敗理由が見え、トーストの文言と合っている
- [x] #6 pnpm test:smoke が通っている
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
候補GETからジョブの進行状態の重ね合わせを消し、取得中表示はクライアントのジョブストアだけから出すようにした。同期済みの印は候補の取り直し成功時のみ、取り直しは後続に打ち切られたときだけ後続を待つ。単発取得の保留はPOST開始以降の照会・イベントで外す。終了通知に対象（codes/unknown）を持たせ、取り逃し時は作品キャッシュを一式無効化。登録失敗があれば未登録タブにとどまる。check・test（server 1255/client 1448）・smoke 40 通過。コミット 25108a92。
<!-- SECTION:FINAL_SUMMARY:END -->
