---
id: TASK-511.1
title: DLsite取得ジョブをRJコード単位の明示開始にする
status: To Do
assignee: []
created_date: '2026-11-19 00:23'
updated_date: '2026-11-19 00:48'
labels:
  - scan
  - dlsite
dependencies: []
references:
  - 'https://claude.ai/artifact/GbuEuRQyKeD9xN4CM3Fv1k'
documentation:
  - docs/adr/0033-dlsite-fetch-before-register.md
  - docs/adr/0034-scan-modal-restructure.md
parent_task_id: TASK-511
priority: high
ordinal: 570000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0033の「取得は未登録の候補に対して、ボタンを押したときだけ行う」「取得ジョブ」「候補の状態はキャッシュから導く」「既存ADRのうち置き換える箇所（ADR-0030・ADR-0029）」を実装する。サーバーの契約変更に合わせて、既存クライアントの全件取得の経路もこのタスクで消す（互換レイヤーは作らない）。

現状（2026-11-19）:
- 暗黙の取得: スキャン完了時（server/src/app.ts:76、ScanJobManagerのonCompleted）、候補登録時（app.ts:94、scanRoute）、作品登録時（app.ts:98、worksRouteの POST /works/projection・POST /works・POST /works/identity-conflicts/reassign）。root再設定の構築後も新規作品を取得へ渡している（ADR-0029 手順6）。
- POST /dlsite/bulk は対象を指定せず、RJコードがあって未適用（none・not_found・error）の全作品を対象にする（selectDlsiteBulkTargets、server/src/adapters/real/dlsiteBulk.ts）。ジョブはWork ID単位。DELETE /dlsite/bulk は待機キューを全消去する（server/src/dlsiteJobManager.ts）。
- 単発の同期取得 POST /dlsite/fetch-by-code・POST /dlsite/:id/fetch はカバーを取得しない。カバーは適用時に初めて取得される（server/src/adapters/real/dlsiteApply.ts の stageCover）。
- DLsiteのSSE（GET /dlsite/events）はheartbeatを送らないので、無音が90秒続くと idleTimeout（server/src/serve.ts）で切れる。TASK-448.3 AC#4はここで吸収する。
- クライアントの全件取得の経路: DlsiteBulkRuntime（client/src/features/dlsite/ui/DlsiteBulkRuntime.tsx）、dlsiteBulkStore・useDlsiteBulk・bulkAtoms（client/src/entities/dlsite/）、ベルと設定の「まとめて取得」（client/src/app/ui/NotificationBell.tsx、client/src/features/settings/ui/SettingsModal.tsx）、上のバーの一括取得表示（client/src/app/ui/TopBar.tsx）、スキャン完了・root再設定後の attach（client/src/features/scan/ui/ScanRuntime.tsx、client/src/app/model/useRootReconfigurationController.ts）。
- スキャン後の自動一括取得を前提にしたsmoke: client/tests/smoke/library.smoke.spec.ts:381-385（「DLsite一括取得:」のトーストを待ってから除外操作に進む）。自動取得がなくなるので、このテストの前提を書き直す。

決めてあること（ADR-0033）:
- ジョブは同時に1本。実行中に別の取得を受けたら、新しいジョブを作らず実行中ジョブのキューに合流させる。
- 起点（まとめて／単発）はproduct codeごとに持つ。進捗の件数（「取得中 n / N」）は起点がまとめてのコードだけを数える。中止は、起点がまとめてで待機中のコードをキューから取り除き、単発のコードは止めない。
- root再設定の開始時は、ジョブ内のキューを起点を問わずすべて捨てる（ADR-0029の読み替え）。
- 再試行・RJコード修正後の取得は失敗の記録を無視する（force）。キャッシュの意味は既存の DlsiteCache.resolve のまま変えない。
- 取得時（ジョブ・同期の単発とも）にカバーも先取りしてキャッシュに置く。
- 取得の終端では、取得したRJコードを持つ候補と既存作品の表示を無効化する。

新しい取得ジョブのクライアント側の追跡はTASK-511.6で作る。それまで統合ブランチではまとめて取得するUIがなく、新規作品タブの「取得待ち」表示（client/src/features/scan/ui/scanModal/dlsiteLinkStatus.ts）もTASK-511.7まで残る。どちらも統合ブランチ内の一時状態として許容する（masterには出ない）。

real/fixture両アダプタで同じ契約を満たすこと（adapter境界より手前のモックで済ませない）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スキャン完了、候補登録、作品登録（POST /works/projection・POST /works・POST /works/identity-conflicts/reassign）、root再設定後の構築のいずれでもDLsite取得が積まれないことをテストで縛っている
- [ ] #2 取得ジョブはproduct codeの集合を受け取って開始し、開始時にジョブIDを返す。対象を指定しない全件取得の経路は無い
- [ ] #3 取得ジョブは同時に1本で、実行中に受けた取得は実行中ジョブのキューへ合流する。起点（まとめて／単発）をproduct codeごとに持ち、再試行と修正後の取得は失敗の記録を無視して取り直す
- [ ] #4 進捗SSEと再接続用のGETが、ジョブIDとproduct codeごとの起点と状態（取得中・取得済み・該当なし・失敗）を返し、SSEはscanと同じ15秒間隔のheartbeatを送る。中止は起点がまとめてで待機中のコードだけを取り除き、root再設定ではキューをすべて捨てる
- [ ] #5 取得ジョブと同期の単発取得（POST /dlsite/fetch-by-code・POST /dlsite/:id/fetch）が、取得時にカバー画像もキャッシュへ保存する
- [ ] #6 クライアントの全件取得の経路（DlsiteBulkRuntime・dlsiteBulkStore・ベルと設定の「まとめて取得」・上のバーの一括取得表示・スキャン完了時のattach）が無く、rg「DlsiteBulkRuntime|dlsiteBulkStore|useDlsiteBulk\b|useDlsiteBulkStore」で参照が残っていない
- [ ] #7 real/fixture両アダプタで契約を満たし、library.smoke.spec.ts の自動一括取得の前提を書き直したうえで pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->
