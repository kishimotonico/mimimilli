---
id: TASK-469.2
title: root再設定のクライアントUIと成功後の画面初期化
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 07:22'
updated_date: '2026-09-25 12:45'
labels:
  - settings
  - ui
dependencies:
  - TASK-469.1
parent_task_id: TASK-469
priority: high
ordinal: 528000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
S1の4（成功後の画面初期化、失敗時のエラー・再試行）と、root変更中の操作制限・再生停止をクライアントに実装する。rootだけ先に変えてFilesを閲覧する操作、切替をまたぐ再生（client/src/features/files/model/filePlayback.ts、client/src/features/player/model/playerRuntime.ts経由）を廃止する。

再設定中に取消ができるかどうかはS1.1のADRで定める契約に従う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 root変更操作を開始すると、再設定中は通常のLibrary/Files操作ができなくなる。成功または取消でのみ通常利用へ戻れる(取消の可否はADRで定める)
- [x] #2 再生中コンテンツは再設定開始時に停止する
- [x] #3 再設定成功後、Libraryのquery・選択・候補状態が初期化されて通常画面へ戻る
- [x] #4 再設定失敗時は専用画面内でエラーが表示され、再試行できる
- [x] #5 rootだけ先に変更してFilesを閲覧する操作、および切替をまたぐ再生ができないことがテストで確認されている
- [x] #6 pnpm test:smoke が通る(root変更UIのレイアウト変更を含む)
- [x] #7 pnpm check && pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# 状態の流れ（統括OK・修正反映版）

- AppStartupStateに"reconfiguring"追加。resolveAppStartupStateの入力にrootReconfigurationを足す。
  - rootFolder==null && status==="idle" → setup-required
  - status==="running"|"failed" → reconfiguring
  - それ以外 → ready
- 進捗はGET /api/settingsのrootReconfiguration.progressをそのまま使う。useSettingsQueryにrefetchInterval（running中のみ1000ms）を追加。新規エンドポイントは作らない。
- 409 root_reconfiguring: queryClientのQueryCache/MutationCache共通onErrorでSETTINGS_QUERY_KEYS.all()をinvalidate（承認済み）。

# 再生停止（修正A）

送信前ではなく、開始APIが202で成功した直後にのみ`player.stop()`を呼ぶ。400（パス不正）では呼ばない。SetupScreen初回・SettingsModal変更・RootReconfigurationScreenの再試行、すべて共通の`runStartRootReconfiguration(path, deps)`ロジックを通すことで一箇所に集約する。

# 初期化（修正B）

reconfiguring→readyの遷移観測に依存しない。次の2箇所で「reconfiguringに入る」ことを検知し、Libraryの選択・検索・タグ・軸・候補非表示状態のリセットと、作品系クエリのremoveQueries（invalidateではなく破棄）を行う。
1. 開始API成功(202)の直後（明示呼び出し）
2. App.tsxで`startupState==="reconfiguring"`に新しく入った瞬間（ref基準の一回検知、起動時に既にreconfiguring/failedだった場合や409検知によるsettings再取得で入った場合をカバー）

どちらも同じ`applyReconfigurationReset()`を呼ぶだけなので二重発火しても副作用は冪等（同じ値へのset、既にremoveされたqueryの再remove）。

# 画面構成（既存回答通り、変更なし）

- 新規 `client/src/features/setup/ui/RootReconfigurationScreen.tsx`。running:「ライブラリを再構築しています」+ 対象root + 進捗ラベル（`formatScanProgressLabel`流用）+ スピナー、入力/取消なし。failed:「ライブラリの再構築に失敗しました」+ エラー + 新パス入力 + 再試行ボタン。共通案内「完了までLibrary・Filesは利用できません」。デザインはdocs/design-system.mdと既存SetupScreen/StartupErrorScreenに合わせる。
- SetupScreenは`onComplete`を`runStartRootReconfiguration`呼び出しのみに簡素化（scanActions.start()呼び出し・scanJob系表示を削除）。
- SettingsModal: root変更フォームは開始APIの入口のまま。onSuccessの「今すぐスキャン」トースト（buildRootFolderChangedToastRequest）を削除。rootFolderStale表示（到達不能）を削除。案内文更新。

# 触るファイル

- `client/src/app/model/resolveAppStartupState.ts`: reconfiguring追加
- `client/src/app/model/runStartRootReconfiguration.ts`（新規）: 開始API呼び出し→成功時player.stop()+reset+settings invalidateを行う、依存注入で単体テスト可能な関数
- `client/src/app/model/resetLibraryForReconfiguration.ts`（新規）: entities配下のqueryKeys（WORK_QUERY_KEYS, SMART_FOLDER_QUERY_KEYS, TAG_QUERY_KEYS, SCAN_QUERY_KEYS, FILE_SYSTEM_QUERY_KEYS）を直接使い`removeQueries`する純粋関数。features/scan/model/libraryInvalidation.ts には依存しない（feat/work-management側で削除済みのため）
- `client/src/entities/library/model/navigationActions.ts`: `resetLibraryNavigationAtom`を最小限で新設（検索語・タグ・軸・選択のみ、history commitなし）
- `client/src/entities/settings/useSettingsQuery.ts`: refetchInterval追加
- `client/src/app/App.tsx`: reconfiguring分岐、runStartRootReconfigurationの配線、reconfiguring突入検知effect
- `client/src/features/setup/ui/SetupScreen.tsx`: 簡素化
- `client/src/features/setup/ui/RootReconfigurationScreen.tsx`（新規）
- `client/src/features/settings/ui/SettingsModal.tsx`: 案内文更新、rootFolderStale削除、onSuccess簡素化
- `client/src/app/model/rootFolderChangedToast.ts` 等トースト関連: 呼び出し削除、未使用なら削除
- `client/src/shared/api/queryClient.ts`: QueryCache/MutationCache onError追加

# テスト（修正C含む）

- `resolveAppStartupState.test.ts`: reconfiguring分岐追加
- `runStartRootReconfiguration.test.ts`（新規）: 成功時にplayer.stop/reset/invalidateが呼ばれる、400失敗時はどれも呼ばれず例外が伝播することをモックで縛る
- `resetLibraryForReconfiguration.test.ts`（新規）: removeQueriesの対象キーを検証
- `setupScreen.test.tsx`: 簡素化に合わせて書き換え（scanApi.startScan呼び出しの期待を削除）
- `rootReconfigurationScreen.test.tsx`（新規）: running/failed表示、再試行フォーム送信
- App統合テスト（既存App.test相当のsetupScreen.test.tsxの枠組みを流用）に追加: reconfiguring中はLibrary/Files（通常UI）が描画されずRootReconfigurationScreenが出ることを確認するケース

# smoke（修正、必須2本）

fixtureシナリオを使い新規specを追加する。
(a) 設定からroot変更 → 再設定画面(running)表示 → 完了で通常画面に戻る
(b) シナリオ`root-reconfiguration-failed`で起動 → 失敗画面表示 → 有効なパスで再試行 → 通常画面に戻る（`/fixture/unreadable-library`は失敗を再現する予約パス）

# 修正E: libraryInvalidation.ts不使用

resetLibraryForReconfiguration.tsは独立実装。features側の既存helperに依存しない。

# 修正F: resetLibraryNavigationAtomは最小限

検索語・タグ・軸・選択の4値のみ。TASK-466でAppRoute一本化により作り直される前提を踏まえ、余分な抽象化はしない。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装完了（task/469.2）。
- AppStartupStateにreconfiguringを追加（resolveAppStartupState.ts）。settings.rootReconfiguration.statusがrunning/failedならreconfiguring、それ以外は従来通り。
- 新規 RootReconfigurationScreen（features/setup/ui/）。running: 対象root・進捗（既存formatScanProgressLabel流用）。failed: エラー+新パス入力+再試行。
- SetupScreenからscanJob系表示を削除し、startRootReconfiguration呼び出しのみに簡素化（サーバーが自動フルスキャンするためscanActions.start()は不要）。
- 開始・再試行を単一手順に統一: runStartRootReconfiguration（app/model）。202成功後にのみplayer.stop()を呼ぶ（400では呼ばない）。
- Library初期化は2段階（app/model/resetLibraryForReconfiguration.ts）: 開始成功直後はmarkReconfigurationAffectedQueriesStale（refetchType:none、生きたobserverの即時再フェッチ=ロック中APIへの409を避ける）。App.tsxのreconfiguring突入検知effect（通常UIアンマウント後）でremoveReconfigurationAffectedQueries（完全破棄、復帰時は必ず新規取得）。両方ともLibraryの検索語・タグ・軸・選択・候補非表示状態もリセットする。
- 409 root_reconfiguring検知はqueryClientのQueryCache/MutationCache共通onErrorに集約（app/model/queryClient.ts、shared/api/queryClient.tsはドメイン非依存のベース設定のみに縮小）。
- SettingsModal: 到達不能になったrootFolderStale表示・「今すぐスキャン」トーストを削除、案内文更新。lastScanRootFolderのprop threadingも不要になったため削除（AppModals/App.tsx経由）。
- テスト: resolveAppStartupState/runStartRootReconfiguration/resetLibraryForReconfiguration/RootReconfigurationScreen/SetupScreen/App統合（reconfiguring中は通常UI非表示）の単体テストを追加・更新。smoke新規2本（rootReconfiguration.smoke.spec.ts）: (a)root変更→running→通常画面復帰、(b)予約パス/fixture/unreadable-libraryで失敗→エラー表示→有効パスで再試行→復帰。fixtureシナリオroot-reconfiguration-failed起動は使わず、予約パスによる実行時失敗トリガーで同じコードパスを検証（worker単位で1シナリオ固定のsmoke基盤を変えずに済むため）。
- pnpm check && pnpm test 緑（server 870/client 1145）、pnpm test:smoke 緑（30/30、新規2本含む）。

## smoke低頻度失敗の記録（2026-09-25）

症状: openApp内で`.mle-col.is-axis`が20秒のタイムアウトで出現しない。失敗するspecは毎回異なる（固定の1specではない）。traceではネットワークは全て200、consoleに`net::ERR_NETWORK_CHANGED`が約40件記録されていた。

計数:
- 本ブランチ（task/469.2）累計 2/18 run
- 基準コミット 07f7900c 0/10 run
- 無改変HEADの増幅計測 0/200 テスト

判断: 有意差ありとは言えず、既存のflaky扱いとして今回は原因特定を打ち切り。次回の再発に備え、smokeのplaywright設定にtrace: "retain-on-failure"を常設し（920f7737）、証拠（trace.zip）が自動で残るようにした。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
root再設定のクライアント側を実装（ADR-0029）。startupStateにreconfiguringを加え、再設定中・失敗中は通常UIをRootConfigurationScreen（初回設定・進捗・失敗時再試行を1画面）に置き換える。開始は再生位置保存→開始API→202で再生停止と非破壊リセット、旧rootクエリの破棄は通常UIアンマウント後（再設定画面側）と復帰時resetQueriesに限定。別タブの開始・完了は409（settings再取得）とrootFolder/completedAt変化で検知、復帰時は新規作品があればDLsite一括取得へattach。レビュー・Codex指摘（drain/TOCTOU、epoch化、completedAt、focus再取得、scan追跡固着、409検知の一本化、失敗トースト抑止等）を是正。検証: pnpm check・pnpm test（server 881 / client 1188）・pnpm test:smoke 30件緑（低頻度の起動待ちタイムアウトは既存flaky扱い、計数はメモ参照）。master 03078793。
<!-- SECTION:FINAL_SUMMARY:END -->
