---
id: TASK-480
title: backlogの陳腐化したタスクとドラフトを現状に合わせて整理する
status: In Progress
assignee:
  - '@mimi2'
created_date: '2026-10-02 11:40'
updated_date: '2026-10-08 03:39'
labels:
  - backlog
dependencies: []
priority: low
ordinal: 538000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-10-02の点検で見つかったbacklogの不整合: TASK-442はrealのreassignIdentityConflict（workMethods.ts:184-213）では解消済みで失敗はfixture（fixture/works.ts:249-259）のみ、TASK-472と範囲が近い。TASK-441の参照コードはLibraryResultsPane.tsx:62-67へ移動済み（バグは残存）。DRAFT-71はscanイベント履歴前提だがADR-0030/TASK-470で廃止済み。DRAFT-47はTASK-456の一括draft保存後の現状を反映していない。DRAFT-56は既存の契約テスト（adapterRulesContract等）を見落としている。draft番号がarchiveと衝突（32/46/47/50/51/74）しADR-0012のDRAFT-50参照が別物を指す。create -p誤用の残骸 backlog/archive/tasks/task-high.1 と task-medium.1 がある。In Progressの340/345/449が実機確認待ちで長期化。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 TASK-442とTASK-441の記述が現在のコードの状態と一致している（不要なら対応なしの根拠付きでクローズ）
- [x] #2 DRAFT-47・DRAFT-56・DRAFT-71の前提が現状に合わせて更新されるか、陳腐化したものは根拠付きで整理されている
- [ ] #3 ADR-0012のDRAFT参照が意図したドラフトを一意に指す
- [x] #4 task-high.1・task-medium.1の残骸ファイルが無い
- [x] #5 TASK-340/345/449の残り受け入れ条件について、実機確認の段取りか処置が決まっている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
442は fixture 限定のバグに書き換えて残し、472と同じバッチで扱う。441は参照位置を更新（バグは残存）。DRAFT-47/56/71 はそれぞれ TASK-456/498/470 の Notes に残りの判断を書いて archive。task-high.1 は正式タスク TASK-285 があるので git rm、task-medium.1 は削除済み。340/345/449 は Done 済みで、345 AC#3 は TASK-478 AC#7 が引き継ぐ。AC#3（ADR-0012 の DRAFT-50 参照）は TASK-479 のブランチで直す。
<!-- SECTION:NOTES:END -->
