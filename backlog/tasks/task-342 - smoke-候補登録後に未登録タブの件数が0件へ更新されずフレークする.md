---
id: TASK-342
title: 'smoke: 候補登録後に未登録タブの件数が0件へ更新されずフレークする'
status: In Progress
assignee: []
created_date: '2026-08-14 16:27'
updated_date: '2026-08-17 20:48'
labels: []
dependencies: []
priority: medium
ordinal: 352000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/tests/smoke/library.smoke.spec.ts:219「スキャン完了後に候補を選択登録でき、問題をFilesで確認できる」が非決定的に失敗する。失敗箇所は234行目で、「2件をライブラリに追加しました」の表示までは通るが、直後の未登録タブ「未登録（0件）」の可視待ちで element(s) not found になる。件数更新はSSEではなくreact-queryのquery invalidation経路。

ADR-0018の実装（TASK-335/336/337）の統合検証中に検出したが、master(34e5ac3)のベースラインworktreeでも再現するため差分起因ではない。同一マシンで交互実行した実測: master 5回中3回失敗、統合ブランチ 5回中2回失敗。失敗するテストは毎回同一で、1回だけ dlsiteBulkApply.smoke.spec.ts:4 も併発した。

TASK-323（openAppの .mle-col.is-axis 可視待ちタイムアウト）とは待機対象が異なる別事象。

参照: client/tests/smoke/library.smoke.spec.ts:219-240、client/tests/smoke/support.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 フルスイートを5回連続実行してlibrary.smoke.spec.ts:219が失敗しない
- [x] #2 件数更新の待機が固定待ちやtimeout延長ではなく確定的な状態の待機になっている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
自動切り替えの発火条件: ScanModal.handleUnregisteredRegistered で remainingCount===0 のとき setActiveTab('newlyRegistered')（ScanModal.tsx:63）。remainingCount は UnregisteredTab の registerMutation.onSuccess が candidates.length - registeredPaths.size で算出。

採用した待機: サイドバー件数ラベル「未登録（0件）」は useScanCandidatesCache（useSyncExternalStore）経由で別レンダーになるため、mutation onSuccess 内の setActiveTab と非同期にずれる。代わりに (1) 新規登録済みタブの aria-selected=true（remainingCount===0 の確定的シグナル）、(2) 新規登録済みタブパネルに登録作品が表示、(3) 未登録タブパネルが非表示、で待機・検証する。

検証: フルスイート5回連続（pw-run3 RUN1-5）で library.smoke.spec.ts:219 に ✘/failed なし。各回 15 passed、所要36-37秒。
<!-- SECTION:NOTES:END -->
