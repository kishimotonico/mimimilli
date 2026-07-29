---
id: TASK-124
title: AppのQuery購読をScanModal/NotificationBellへ降ろし残る再レンダリング源を断つ
status: To Do
assignee: []
created_date: '2026-07-29 18:02'
updated_date: '2026-07-29 18:27'
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
- [ ] #1 ファイル→ライブラリ切替（staleTime 経過後）で App が再レンダリングされない（実測で確認）
- [ ] #2 スキャン実行中に App が再レンダリングされない（実測で確認）
- [ ] #3 libraryTotalQuery が ScanModal へ降り、App から参照されていない
- [ ] #4 lastScanQuery が NotificationBell / ScanModal へ降り、App から参照されていない
- [ ] #5 スキャンモーダルの統計表示・通知ベルの直近スキャン結果表示が従来どおり動作する
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
着手順（2026-07-30 の方針レビューで決定）: TASK-110 → TASK-111 → TASK-124 → TASK-125。

本タスクは確立したばかりの「App はランタイム状態を購読しない」という不変条件の回復だが、現在の実害は余計な再描画に留まるため、正しさに直結する TASK-110（一時停止中に音が出る）と TASK-111（保存失敗を成功と表示）より後で問題ない。

注意: TASK-111 と本タスクはどちらも ScanModal.tsx を触るため、並行実装は避けること。TASK-110 は独立しているので、並行化するなら「110」と「111 → 124 → 125」の2系列に分けるのが自然。
<!-- SECTION:NOTES:END -->
