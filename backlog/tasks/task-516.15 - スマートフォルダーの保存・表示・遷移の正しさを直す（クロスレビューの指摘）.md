---
id: TASK-516.15
title: スマートフォルダーの保存・表示・遷移の正しさを直す（クロスレビューの指摘）
status: Done
assignee: []
created_date: '2026-11-22 18:02'
updated_date: '2026-11-22 18:40'
labels:
  - library
  - ui
dependencies: []
parent_task_id: TASK-516
priority: high
ordinal: 616000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-516 の最終レビュー（Fable）とクロスレビュー（Codex）で見つかった、正しさの問題を統合ブランチ feat/library-folders で直す。指摘の詳細は実装メモ。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 既定の並びの保存は並びだけを更新し、ほかの編集を巻き戻さない（A1）
- [x] #2 否定した長さ条件の表示が意味どおりで、gte・lte の否定が表示テストにある（A2）
- [x] #3 「すべて」の行が壊れても、固有の並びを持つ正常なスマートフォルダーは開け、継承する行は理由を表示する（A3）
- [x] #4 並びだけを変えた上書きのあと「戻る」で上書き前に戻れ、通常の並び変更は履歴を積まない（A4）
- [x] #5 保存中に閉じたダイアログの応答が後のダイアログを閉じず、連続ドラッグの保存は直列で最新の順が残る（A5・A6）
- [x] #6 層からのタグの Ctrl/Cmd+クリック、編集でのグループ分けの変更、await 後の補正で、層と route が正しく保たれる（A7・F1・F2）
- [x] #7 空白だけの検索語は、0件の案内・選択解除・値一覧からの検索で絞り込みなしとして扱われる（R1）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 指摘（クロスレビュー 2026-11-23。行番号は 221bbabd）

- A1 既定の並びの保存（useSmartFolderEditor.ts:151）が表示時点の名前・条件・グループ分けごと PUT するので、別タブでの編集を巻き戻す。並びだけを受ける更新操作を設け、アダプタも sort 列だけを更新する。「すべて」の sort を null にできない制約もこの入口に適用する。
- A2 smartFolderEditing.ts:61 の長さ条件の表示が、否定時に以上/以下を反転したうえで末尾でも否定し、意味が逆になる。以上/以下は op だけで決め、否定は末尾で一度だけ。
- A3 「すべて」の行が壊れると resolveLibraryView.ts:50 が throw し、固有の並びを持つ正常なフォルダーも開けない。userWorkStateRepository.ts:378 は1列読めないだけで3列とも null にする。all の存在確認と並びの解決を分け、選択した行に要る値だけを確認する。継承元の並びが読めないときは結果面に理由を出し、正常な行への移動は保つ。壊れた「すべて」の扱い（削除不可）も破綻しないようにする。
- A4 並びだけを変えた上書き（useSaveSearch.ts:47 の push）が、useRouteHistorySync.ts:139 の「同一 URL の push は replace」で履歴を積まない。明示した push は同一 URL でも積めるようにし、通常の並び変更は replace のまま。同期テストを2操作に分けて確認。
- A5 保存中に ×・キャンセル・Esc で閉じて次の編集を開くと、前の保存の成功で新しいダイアログが閉じる（SmartFolderDialog.tsx:108、SmartFolderDialogHost.tsx:26）。保存中は閉じ方と入力をすべて止めるか、保存を始めたダイアログがまだ開いているときだけ完了後の UI 操作を適用する。
- A6 連続ドラッグの保存（useSidebarReorder.ts:41、useSmartFolderEditor.ts:139）が並行して走り、遅れた応答で表示が戻る・永続化の順が逆転しうる。編集のフックで直列化し、待つ間は最新の希望順だけを保持する。
- A7 再生中の層で、選択済みのタグを Ctrl/Cmd+クリックすると層が残る（libraryRouteTransitions.ts:121 の早期 null）。重複時の早期終了は layer が無いときに限り、層からの操作では一覧へ移る。
- F1 編集でグループ分けを変えると、開いている一覧の ?group= が新しい groupBy で評価される・「なし」にすると URL に残る（SmartFolderDialogHost.tsx:23、resolveLibraryView.ts:71）。groupBy が変わり、そのフォルダーを保持していれば replaceLibraryFolder(id) で入り直す。判定は useSmartFolderEditor.update（remove と同じ場所）。
- F2 appRouteAction（appRouteStore.ts:28-39）が補正（選択解除の cleanup・削除後の replaceLibraryFolder・既定保存後の clearLibrarySort）でも層を落とす。await の後に走る補正が、その間に開いた層を閉じる。「遷移」（層を落とす）と「補正」（層を保つ・常に replace）の口を分け、useLibrarySelectionCleanup.ts の layerAtom 参照を無くす。
- R1 検索語の正規形（normalizeSearchQuery）が WorksEmptyState.tsx:35・libraryPresentation.ts:80 computeIsNoResultsDueToFilter・libraryRouteTransitions.ts:183 に届いていない。空白だけの q で判定が食い違い、値一覧で空白を打つと /library/all?q=%20 へ移る。判定を1か所（isRefined 相当を entities 側）に寄せる。

- レビュー（Opus）で列単位の null 化の見送りを統括が承認（壊れた行は3列まとめて null）。壊れた「すべて」は UI から直さない（ADR-0040）。
<!-- SECTION:NOTES:END -->
