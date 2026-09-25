---
id: TASK-469.1
title: root再設定のサーバー側ワークフロー（状態管理・検証・catalog再構築）
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 07:22'
updated_date: '2026-09-25 03:56'
labels:
  - settings
  - scan
  - server
dependencies: []
parent_task_id: TASK-469
priority: high
ordinal: 525000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
S1の1〜3（実行中の管理ジョブ終了、操作ロック、検証→catalog・候補構築）と、旧rootにのみ存在した作品の扱いをサーバー側に実装する。対象ファイルはserver/src/adapters/real/settingsScanMethods.ts中心。

再生の停止（ブラウザ側の状態）はクライアント側（S1.2）の責務とし、本タスクは実行中の管理ジョブ（scan/DLsite等）の終了と、再設定中のメディア配信・通常操作APIの拒否を扱う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 新しいADRでroot再設定の状態遷移(通常運用/再設定中/失敗)・操作ロックの範囲・失敗時の再試行契約を記録している
- [x] #2 root変更開始時に、実行中の管理ジョブ(scan/DLsite等)を終了させる
- [x] #3 再設定中はメディア配信・Library/Files/scan開始等の通常操作APIを拒否する状態を持つ
- [x] #4 対象rootの検証に成功すると、そのrootに対応するcatalogと候補が構築される
- [x] #5 途中で停止した場合、再設定が未完了であることをサーバー側の状態から判断できる
- [x] #6 旧rootにのみ存在した作品はcatalog一覧から外れるが、user状態は保持されることがテストで確認されている
- [x] #7 失敗時はエラーとともに再設定状態が維持され、再試行できることがテストで確認されており、pnpm check && pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
ADR: docs/adr/0029-root-reconfiguration-workflow.md（統括承認済み）
1. shared: shared/src/rootReconfiguration.ts（RootReconfigurationState / 開始body / GET・POST応答）、Settings に rootReconfiguration 追加、ApiError code に root_reconfiguring 追加、settingsUpdateSchema 削除
2. client APIクライアント: setRootFolder 相当の薄い関数を新契約（POST /api/root-reconfiguration、GET /api/root-reconfiguration、Settings.rootReconfiguration）へ置き換え、client/tests/unit/api.test.ts も合わせる。UI（SetupScreen・SettingsModal・App.tsx）は触らない。その他の型エラーは最小修正のみ
3. adapter境界: server/src/adapter/rootReconfiguration.ts（resolveRootFolder / getRootReconfigurationRecord / beginRootReconfiguration / rebuildCatalogForRoot / failRootReconfiguration / completeRootReconfiguration）。SettingsAdapter.updateSettings 削除、getSettings は rootReconfiguration を含めない（ワークフローが合成）
4. real: settingsScanMethods.ts の updateSettings を分解し、検証・begin（root_folder と running を同一transaction、root変更時は候補除外/候補session破棄）・fail・complete を実装。catalogWorkRepository に新root配下外の works 行削除を追加。rebuild=範囲外削除→フルスキャン（worker経路含む）
5. fixture: settingsScan.ts に同メソッド。範囲外作品はアダプタ内に退避し、root戻しで復帰（user状態保持）。擬似構築時間・予約パス /fixture/unreadable-library で失敗・シナリオ root-reconfiguration-failed
6. server/src/rootReconfiguration.ts: RootReconfigurationWorkflow（状態遷移、ジョブ終了順序、進捗、中断の解釈、shutdown）。ScanJobManager に構築結果を直近完了結果として記録するメソッドを追加。新規作品は DLsite new キューへ渡す
7. app.ts: ワークフロー生成、ロックmiddleware（許可リスト以外は409 root_reconfiguring）、RootReconfiguringError→409変換、routes/rootReconfiguration.ts、GET /settings に状態合成、shutdown配線。routes/settings.ts の PUT 削除。許可リストは、469.2の再設定画面が起動時に叩くAPI（静的配信以外のクライアント初期化経路）を実装時に洗い出して確認し、必要なら追加してADRの表も更新する
8. テスト: server/tests/rootReconfigurationContract.test.ts（real/fixture両方、HTTP経由）
   - AC#6: 範囲外作品がcatalogから外れ、root戻しでbookmark等が復帰する
   - AC#7: 失敗→failed維持・通常API 409→再試行で成功する
   - ロック中の許可・拒否
   - 実行中scanジョブの取消
   - realは同一DBでadapterを再生成し、中断・失敗が読めること
   既存テストの updateSettings 呼び出しは tests/helpers の root設定ヘルパー（resolve→begin→complete）へ機械的に置換し、期待値は変えない。settingsRoute・updateSettingsLogging テストは新APIへ書き換え
9. docs/ARCHITECTURE.md のデータフロー・サーバー境界を更新。最後に pnpm check && pnpm test（緑）。smoke は469.2完了まで赤（feat/root-reconfigure 上で解消）
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
段階2実装完了（task/469.1）: RootReconfigurationWorkflow（server/src/rootReconfiguration.ts）、RootReconfigurationAdapter（real/fixture）、POST/GET /api/root-reconfiguration、ロックmiddleware（409 root_reconfiguring）、PUT /settings・settingsUpdateSchema・updateSettings削除。契約テスト server/tests/rootReconfigurationContract.test.ts（real/fixture）。既存テストのupdateSettingsはtests/helpers/rootFolder.tsのconfigureRootへ機械置換（期待値不変）。pnpm check && pnpm test 緑（server 870 / client 1139）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
root変更をPOST /api/root-reconfigurationの再設定ワークフロー（server/src/rootReconfiguration.ts）に置き換えた（ADR-0029）。検証→ロック→scan/DLsite一括ジョブ終了→root_folderとrunningを同一トランザクションで確定→新root外のcatalog行削除→フルスキャン→完了で状態消去/失敗でfailed維持。ロックmiddlewareはADR表の4件以外を409 root_reconfiguringで拒否、再起動後はrunning残存を中断(failed)として返す。PUT /api/settings・settingsUpdateSchema・updateSettings・client setRootFolderは削除。検証: rootReconfigurationContract.test.tsをreal/fixture両方で実行、pnpm check && pnpm test 緑（server 870/client 1139）、Sonnetレビューで報告外副作用なし。client UIのroot変更フロー（App.tsxの開始直後scan開始）は469.2で作り直す前提で、masterマージは469.2完了後。feat/root-reconfigure 2dfb0d3d。
<!-- SECTION:FINAL_SUMMARY:END -->
