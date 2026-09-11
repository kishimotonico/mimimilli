---
id: TASK-447.5
title: DLsite適用ダイアログの状態表現と未登録候補のタイトル編集を直す
status: Done
assignee: []
created_date: '2026-09-11 00:52'
updated_date: '2026-09-11 01:57'
labels:
  - ui
  - ux
  - triage
dependencies:
  - TASK-447.1
parent_task_id: TASK-447
priority: high
ordinal: 473000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-447 の「直す」判定のうち 428.1・428.19 を直す。428.1 のユーザー理由「変更意図はOK、UIが文字に頼り過ぎで分かりづらい」（対象は「取得結果を確認」で開く DLsite 適用ダイアログ）。428.19 のユーザー理由「ESCの挙動は取り込みOK。未スキャンのタイトルをその場で編集できるのは微妙（編集したいのはDLsite連携後）」。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 DLsite 適用ダイアログの「変更なし」「適用不可」の行が減光とチェック不可で区別され、説明文の行が無い。行末に短い1語（「同一」「対象外」）を残し、詳しい理由はツールチップ等で見られる
- [x] #2 スキャンの未登録タブで候補のタイトルをその場で編集できない（master と同じ表示）
- [x] #3 RJコード欄の Escape で編集だけが取り消されモーダルが開いたままの挙動と、DLsite 一括適用の非破壊・差分選択式は残っている
- [x] #4 着手前後のスクリーンショット（fixture、1440x900）を tmp/uiux-triage-2026-09-11/shots-intake/447.5-before.jpg と tmp/uiux-triage-2026-09-11/shots-intake/447.5-after.jpg に置き、タスクメモから参照している
- [x] #5 変更範囲のテストが通り、既存テストの期待値を削除・緩和していない（仕様変更で書き換えた期待値はタスクメモに列挙）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装完了。変更範囲テスト・oxlintはPASS。pnpm check/test:smokeは統括側の最終レビューで実施を推奨（作業中は変更範囲のみ実行方針のため）。

サーバー側の title フィールド（shared/src/scan.ts の scanCandidateRegisterItemSchema.title、server/src/adapters/real/scanCandidateSession.ts:82、server/src/adapters/fixture/settingsScan.ts:121 resolveRegisteredTitle）はタイトル編集専用に追加されたもので、クライアントからは呼ばれなくなった。除去するかは統括判断のため未着手（report参照）。

pnpm check / pnpm test（1084件）/ pnpm test:smoke（25件）すべてPASS。client/tests/unit/scanModal.test.ts の登録payload期待値からもtitleフィールドを削除（タイトル編集撤去に伴う辻褄合わせではなく仕様変更）。

サーバー側title除去対応（統括依頼）完了。
- shared/src/scan.ts: scanCandidateRegisterItemSchema.title を削除
- server/src/adapters/real/scanCandidateSession.ts: title: item.title ?? current.inferredTitle → title: current.inferredTitle（master 1c64edaと一致確認）
- server/src/adapters/fixture/settingsScan.ts: resolveRegisteredTitle関数と呼び出しを削除、title: candidate.inferredTitleへ戻す（master相当）
- 削除したテスト: server/tests/fixtureScenarios.test.ts の「fixture: title省略・指定を区別する」「候補登録APIはHTTP境界の正規化からfixture adapterの保存まで、titleの省略・指定をモックを挟まず通す」、server/tests/real/scanCandidates.test.ts の「タイトル省略時は推定タイトルを使い、指定時はそのタイトルで登録する」、server/tests/scanCandidatesRoute.test.ts の「scanCandidateRegisterItemSchema: titleは前後の空白をtrimし、空・省略を区別する」「候補登録APIは空白のみのtitleを4xxで拒否し、adapterへ渡さない」（計5件）
- pnpm check: PASS / pnpm test: server 795件（旧800件、-5）・client 1084件（変更なし）全PASS
<!-- SECTION:NOTES:END -->
