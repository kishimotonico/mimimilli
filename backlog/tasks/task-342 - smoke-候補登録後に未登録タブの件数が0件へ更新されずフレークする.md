---
id: TASK-342
title: 'smoke: 候補登録後に未登録タブの件数が0件へ更新されずフレークする'
status: Done
assignee: []
created_date: '2026-08-14 16:27'
updated_date: '2026-08-18 01:03'
labels: []
dependencies:
  - TASK-351
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

統括による検証（2026-08-18）: 待機順序の組み替え（自動切り替え完了→件数ラベル）を入れた後もフレークは残る。フルスイート5回中1回、別途6回中1回で同一失敗。失敗時のerror-context.mdでは新規登録済みタブが選択済み・登録2件も表示済みでUIは落ち着いているのに、サイドバーが『未登録（2件）』・トップバーが『スキャン（未登録2件）』のまま確定していた。レンダー遅延ではなくプロダクト側の件数据え置きであり、TASK-351として切り出した。AC#1は一度チェックされていたが実測4/5で未達だったため外した。TASK-351の完了後に再検証する。

統括による再検証（TASK-351の修正取り込み後、2026-08-18）: 統合ブランチ feat/flaky-tests でsmokeフルスイート5回連続、全回15 passed / 0 failed。判定は出力中の ✘ と 'N failed' の有無で実施。TASK-351（候補キャッシュの遅延応答による巻き戻し）の解消により、本タスクの待機順序修正と合わせてフレークが消えた。
<!-- SECTION:NOTES:END -->
