---
id: TASK-124
title: AppのQuery購読をScanModal/NotificationBellへ降ろし残る再レンダリング源を断つ
status: Done
assignee: []
created_date: '2026-07-29 18:02'
updated_date: '2026-07-30 07:22'
labels: []
dependencies: []
priority: medium
ordinal: 134000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-120〜123 完了後の総合レビュー（Fable が実測で検出、Codex レビューと統合）。

App.tsx が保持する libraryTotalQuery が、TASK-123 までで塞いだはずの App 再レンダリング経路を別レイヤーで復活させている。memo ゼロ設計のため App が再描画すると全ツリーへ波及する。

真因（Fable の対照実験で確定。App 側の query を無効化すると 0 回、戻すと再現）:

1. App.tsx:244,248 の libraryTotalQuery.data 参照が activeModal === "scan" && の短絡評価の中にしかなく、スキャンモーダルが閉じている間は .data へのプロパティアクセスが一度も起きない
2. TanStack Query v5 の tracked-props 最適化は「アクセスされたプロパティのみ変化を通知」するが、trackedProps が空の観測者は無条件通知にフォールバックする（queryObserver の !notifyOnChangePropsValue && !trackedProps.size → 常に通知）。そのため fetchStatus / dataUpdatedAt の変化まで App へ通知される
3. さらに useLibraryQueries.ts:129-132 が同一キー WORK_QUERY_KEYS.total() を重複購読しており、LibraryView マウント時の refetch（stale 時）とスキャンの invalidate が引き金になる

実測: ファイル→ライブラリ切替（staleTime 30秒経過後）とスキャン中に App が論理2回再レンダリングし、App / PlayerDock / FullScreenPlayerGate / PlayerRuntime が各4カウント。ライブラリ→ファイル方向は0回という非対称。

対処の本筋は libraryTotalQuery を唯一の消費者である ScanModal へ降ろすこと（モーダルが開いた時だけマウント・購読される）。lastScanQuery も消費者が NotificationBell / ScanModal なので同時に降ろす（App に残すと同型の trackedProps 問題が再発しうる、というレビュー時の指摘に基づく）。

実害の規模は小さい（発生経路が stale 経過後のモード切替とスキャン中に限られる）が、TASK-109 系で確立したばかりの「App は state を購読しない」という不変条件の破れなので、フォローアップ5件の中では着手順を先頭にする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ファイル→ライブラリ切替（staleTime 経過後）で App が再レンダリングされない（実測で確認）
- [x] #2 スキャン実行中に App が再レンダリングされない（実測で確認）
- [x] #3 libraryTotalQuery が ScanModal へ降り、App から参照されていない
- [x] #4 lastScanQuery が NotificationBell / ScanModal へ降り、App から参照されていない
- [x] #5 スキャンモーダルの統計表示・通知ベルの直近スキャン結果表示が従来どおり動作する
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
着手順（2026-07-30 の方針レビューで決定）: TASK-110 → TASK-111 → TASK-124 → TASK-125。

本タスクは確立したばかりの「App はランタイム状態を購読しない」という不変条件の回復だが、現在の実害は余計な再描画に留まるため、正しさに直結する TASK-110（一時停止中に音が出る）と TASK-111（保存失敗を成功と表示）より後で問題ない。

注意: TASK-111 と本タスクはどちらも ScanModal.tsx を触るため、並行実装は避けること。TASK-110 は独立しているので、並行化するなら「110」と「111 → 124 → 125」の2系列に分けるのが自然。

実装完了（AC#1/#2の実測確認は検証担当が対応）。

変更内容:
- App.tsx: libraryTotalQuery（WORK_QUERY_KEYS.total）と lastScanQuery（SCAN_QUERY_KEYS.last）を削除。NotificationBell/ScanModalへのprops（scanResult/lastResult/libraryTotal）受け渡しをやめた
- ScanModal.tsx: 唯一の消費者としてlibraryTotalQuery・lastScanQueryを自身でuseQuery。propsからlastResult/libraryTotalを削除しlastScanTimeのみ受け取る
- NotificationBell.tsx: lastScanQueryを自身でuseQuery。propsからscanResultを削除

設計判断:
- useLibraryQueries.ts:129-132のlibraryTotalQuery（LibraryView用）はそのまま維持。ScanModal側は別のuseQuery呼び出しだが同一queryKeyのため、TanStack Queryのキャッシュは共有される（フェッチは重複しない）。各コンポーネントが自分の必要なプロパティ（.data）に実際にアクセスするため、trackedPropsが空にならずApp側で起きていたfetchStatus等の変化での無条件通知は起きない
- 重複購読自体（App/LibraryViewで同一キーを2箇所購読）は今回のAC範囲外（App側の購読を無くすことが本旨）のため未変更。TASK-125側の課題とは別軸

テスト:
- pnpm check（typecheck/lint/fmt）全通過
- pnpm test 全通過（server 344件・client 348件）
- notificationBell.test.ts / scanModal.test.ts をQueryClientProviderでラップし、props経由だったlastResult/libraryTotal/scanResultをqueryClient.setQueryDataでシードする形に書き換え
- appRootSubscriptions.test.tsxに退行テスト2件追加（WORK_QUERY_KEYS.total() / SCAN_QUERY_KEYS.last() の更新でAppが再レンダリングされないこと）

残る懸念:
- AC#1/#2の実測（ファイル→ライブラリ切替・スキャン中の非再レンダリング）は検証担当のagent-browser実測待ち
- TASK-111直後のScanModal.tsx（handleSaveTitle周り）とは競合なし、最新masterから作業

検証担当による実測完了（console.count 一時計装、react renders 計測不使用、StrictMode により生カウントは論理回数の2倍）。AC#1: ファイル→36秒待機→ライブラリ切替で App 0回（修正前実測2回→0回）。陽性対照: 設定モーダル開閉で論理1回の増加を確認。AC#2: 実ライブラリ11件への再スキャンで論理1回のみ。残る1回は ScanRuntime のスキャン完了時 SETTINGS_QUERY_KEYS invalidate → App が JSX で実際に使用する settingsQuery.data の lastScanTime 変化による正当な再レンダリングで、本タスクの真因（tracked-props 空フォールバック）とは別経路・スコープ外と判断（libraryTotalQuery / lastScanQuery の参照は App からゼロを rg で確認済み）。破壊テスト: App.tsx へ旧実装相当（トップレベル useQuery・.data アクセスなし）を一時復元すると追加退行テスト2件が expected 2 to be 1 で失敗することを確認し、完全復元。ScanModal / NotificationBell の useQuery は .data のみアクセスで trackedProps 空の再発なし、条件付きマウント構造も維持。機能維持（モーダル統計・ベルの直近スキャン表示）もブラウザ確認。pnpm check / pnpm test（server 344 / client 348）全通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
App.tsx が保持していた libraryTotalQuery / lastScanQuery を唯一の消費者である ScanModal / NotificationBell へ降ろし、TanStack Query v5 の trackedProps 空観測者への無条件通知で App 全体が再レンダリングされる経路を断った。実測でモード切替（staleTime 経過後）の App 再レンダリングが2回→0回、スキャン中は正当な settings 更新由来の1回のみになったことを確認。退行テスト2件を appRootSubscriptions.test.tsx へ追加し、破壊テストで実効性を確認済み。
<!-- SECTION:FINAL_SUMMARY:END -->
