---
id: TASK-469
title: root変更を再設定ワークフローに置き換える
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-24 07:22'
updated_date: '2026-09-25 03:28'
labels:
  - settings
  - scan
  - architecture
dependencies: []
priority: high
ordinal: 523000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
背景: docs/specification-review-2026-09-20.md S1。ユーザー決定（2026-09-24）: Astra案の再設定ワークフローを採用する。

現状: TASK-459（Done, `f9a49a8f`）はS1のうち「候補除外・候補sessionの破棄」だけを実装済み。再設定ワークフロー本体（操作ロック、検証→構築、画面初期化、失敗時のエラー・再試行）は未実装のまま。

現在のコード根拠:
- server/src/adapters/real/settingsScanMethods.ts（root_folder更新）
- client/src/app/App.tsx（変更直後の無効化）
- client/src/features/files/model/filePlayback.ts（未登録再生キューのroot相対パス解決）
- client/src/features/player/model/playerRuntime.ts
- server/src/adapters/real/coverMediaMethods.ts

採用するワークフロー（ユーザー決定）:
1. root変更を開始する前に、再生と実行中の管理ジョブを終了する。
2. 再設定中は通常のLibrary/Files操作を閉じる。
3. 対象rootを検証し、そのrootに対応するcatalog・候補を構築する。
4. 成功後に画面のquery・選択・候補状態を初期化して通常利用へ戻る。失敗時は再設定画面でエラーと再試行を扱う。

同じWork UUIDのuser状態を保持する方針は維持する。新rootからcatalogを再構築した結果、旧rootだけに存在した作品はcatalog一覧から外れるが、user状態は残す。段階切替・世代管理（旧rootを利用しながら新rootを準備する等）は作らない。rootだけ先に変えてFilesを閲覧する操作、切替をまたぐ再生は廃止する。

範囲外: 複数ライブラリの並行管理（library registry）、旧世代メディアlease。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 子タスク(S1.1・S1.2)がすべて完了している
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 現状調査（2026-09-25、master基準）

- root変更: server/src/adapters/real/settingsScanMethods.ts updateSettings がrealpath検証→root_folder保存(user DB)→候補session破棄(TASK-459)のみ。catalog再構築・ジョブ終了・ロックはしない。routes/settings.ts PUT /settings はそのまま委譲。fixture(settingsScan.ts)も同じ意味論。
- client: App.tsx changeFolderMutation は SETTINGS/SCAN候補のinvalidateとトーストのみ。再生停止・画面初期化なし。UIは SettingsModal 内のフォームで、同モーダルにscan開始・DLsite一括ボタンが同居。
- ジョブ終了: scanJobManager.cancelActiveAndAwait / dlsiteJobManager.cancelActiveAndAwait が既にあり、app.ts の /api/__test__/reset で併用済み。ただしjob managerはcreateAppローカルで settingsRoute/adapter からは触れない → 配線が必要。
- 状態の持ち方: root_folder はuser DB(永続)、candidateSession はprocess内変数。再設定中/失敗の専用フィールドは無い。AC#5(再起動後も未完了判断)を満たすには永続化が要る。
- API拒否: 共通の状態依存middlewareは無い(app.use はログのみ)。NotConfiguredError→409 の変換パターンが流用候補。
- 再生: URL構築は useAudioEngineLifecycle.ts(getWorkspaceMediaUrl(track.file))。root変更後も旧root相対パスのURLが残る。usePlayerActions の stop はあるが root変更時に呼ぶフックが無い。queryClient.clear/resetQueries の使用例はclientに無い。
- 前例: SetupScreen(startupState==="setup-required")が通常UIを丸ごと置き換える。resolveAppStartupState の4値に "reconfiguring" 相当を足せば同じ枠組みで実現できる。

設計判断が要る論点: 再設定中の取消可否 / 状態の永続化先 / root_folderをいつ確定するか / 旧rootのみの作品のcatalog行を削除か非表示か / fixtureでの対称実装 / 状態とmiddlewareの置き場所(adapter層かapp層か)。

## ユーザー決定（2026-09-25）
- 再設定中の取消は作らない。失敗時は再設定画面に留まり再試行のみ。旧rootへ戻すには旧パスを入れて再試行する。
- root検証成功時点で root_folder を確定し、同時に「再設定中」状態をuser DBへ永続化する。完了時に状態を消す。再起動後も再設定画面へ戻れる。
- 旧rootにのみ存在した作品はcatalogを新rootで作り直す（行削除）。user状態はWork UUIDで保持。missing扱いでは残さない。
- 実装構造（統括推奨）: 再設定ワークフローはserver/coreのapplication service。job manager終了・adapter・再設定中は通常APIを409で拒否するmiddlewareを app.ts で配線。クライアントは startupState に再設定中を足してSetupScreen同様に通常UIを置き換える。
<!-- SECTION:NOTES:END -->
