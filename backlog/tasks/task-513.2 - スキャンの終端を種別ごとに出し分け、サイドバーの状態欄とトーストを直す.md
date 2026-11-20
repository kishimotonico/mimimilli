---
id: TASK-513.2
title: スキャンの終端を種別ごとに出し分け、サイドバーの状態欄とトーストを直す
status: To Do
assignee: []
created_date: '2026-11-20 10:40'
labels:
  - scan
  - ui
dependencies: []
references:
  - 'https://claude.ai/artifact/XvdN9UKvcg9GtL2gixXQ34'
documentation:
  - docs/adr/0039-scan-modal-current-problems-and-explicit-states.md
parent_task_id: TASK-513
priority: high
ordinal: 590000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0039「「分からない」を空や完了と区別する」のうちスキャンジョブの終端。今は useScanCompletionHint が実行中から抜けたことだけを見て、中止・失敗でも緑の「完了しました」を出し、モーダル表示中の中止はどこにも出ない（監査H1、確認済み）。ジョブsnapshotの status・error を使い、サイドバーの状態欄を待機・実行中・中止受付中・完了・中止・失敗の6状態で出し分ける。状態欄の見出しと内容を一致させ（「最終スキャン」固定をやめる）、日時は年入り（例 2026/11/20 14:02）。スキャンの日時とスキャンボタンはサイドバーの状態欄にだけ置く。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 中止・失敗では完了表示が出ず、それぞれ「中止しました」「スキャンできませんでした」＋短い理由と再試行を出す。完了を表す色は完了のときだけ使う
- [ ] #2 中止を押してから終端までのあいだは中止受付中の表示になり、中止ボタンは押せない
- [ ] #3 状態の切り替えで文字が重ならない（クロスフェード中の二重表示がない）
- [ ] #4 モーダルを閉じているあいだの終端をトーストで知らせる。完了は今回の変化の件数（変化なしならそう出す）、中止は通常トースト、失敗は自動で消えないエラートーストで、どれもモーダルを開ける。完了で変化があれば入口に点が付き、開くと消える
- [ ] #5 まだスキャンしていないとき、サイドバーのスキャンボタンが主ボタンの見た目になる
- [ ] #6 遅延・失敗を注入したテストで、完了・中止・失敗それぞれの表示を確かめている
<!-- AC:END -->
