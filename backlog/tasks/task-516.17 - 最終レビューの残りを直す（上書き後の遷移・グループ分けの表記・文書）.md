---
id: TASK-516.17
title: 最終レビューの残りを直す（上書き後の遷移・グループ分けの表記・文書）
status: Done
assignee: []
created_date: '2026-11-22 19:36'
updated_date: '2026-11-22 20:05'
labels:
  - library
  - ui
dependencies: []
parent_task_id: TASK-516
priority: high
ordinal: 618000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-516 の統合ブランチ全体の最終レビュー（Fable、f005c443）の should-fix と nit を統合ブランチ feat/library-folders で直す。指摘の詳細は実装メモ。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 await 後の上書き・テンプレートからの追加の遷移が、その間に移った画面と層を引き戻さない（S1）
- [x] #2 グループ分けのラベルは1つの関数から引かれ、addedYear はどこでも「追加年」（S2）
- [x] #3 ADR-0040・0041・design-system・requirements の S3・S4 の食い違いが直っている
- [x] #4 computeIsNoResultsDueToFilter の不要な引数と古い説明が無い（S5）
- [x] #5 保存中のスマートフォルダーのダイアログはどの操作でも閉じない
- [x] #6 実装メモの nit が反映され、範囲外の気づき2件は事実確認の結果に応じて直すか根拠付きで対応なしになっている
<!-- AC:END -->













## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 指摘（最終レビュー 2026-11-23。行番号は f005c443）

- S1 上書き後の入り直し（useSaveSearch.ts:50-53 の await 後の reenterFolder）が遷移のままで、await 中に層を開いた・別画面へ移ったときに引き戻して層を閉じる。保存を始めたときと同じ画面（mode library・layer なし・同じ folderId）にいるときだけ reenter（push）、そうでなければ補正 replaceLibraryFolder(id, id)。LibrarySidebarPanel.tsx:113-117 の addFromTemplate → onOpenFolder も同じ形にそろえる。
- S2 グループ分けのラベル表が3か所（smartFolderDefinitions.ts:7-15 getGroupByLabel、:58-67 buildGroupByRows、smartFolderEditing.ts:118-131 groupByOptions）で、addedYear が「追加日」「追加年」「追加年別」とばらつき、prefix もダイアログだけ `cv/`。ラベルは1つの関数から引き、addedYear は「追加年」に統一（ADR・requirements どおり）。
- S3 real の total・件数・値一覧の件数は読めない作品を含む。コードは変えず、ADR-0040「件数」に「件数は SQL の値で、差はデータ不整合の件数が示す」を1行。
- S4 文書: ADR-0041:99・:137 の補正の列挙に normalizeLibraryFolder（:137 は補正で URL からも外す）、ADR-0040:68 の「最後の子を外したらまとまりごと消す」は実装に無いので実装どおりに、ADR-0040:240・requirements-v4.md:324 の「値を選んでいないグループ分けからはグループ分けを保つ」は複製の規則へ移す、ADR-0040:187 にアイコンも ID で引くことを足す、design-system.md:209 IconButton xs は 20px、ADR-0041:23 パンくずの先頭「ライブラリ」、design-system.md:340 見送り案の「不正な URL は 404 のまま見せる」を今の挙動に合わせる。軽微: ADR-0040:151 値一覧の並びに「総時間」、requirements-v4.md:347 並び順に「ID順」、ADR-0041:91 層の入口に「再生画面へ」、ADR-0041:147 sort・seed を書くのはライブラリ画面だけ。
- S5 computeIsNoResultsDueToFilter（libraryPresentation.ts:67-82）の定数引数3つと古い JSDoc を消し、works.length === 0 && hasChipOrSearchRefinement に畳む。テストも減らす。
- nit: SmartFolderDialog.tsx:118 保存中は ×・キャンセル・Esc・背景クリックをすべて止める（統括判断）。sameGroupBy は groupByKey の比較に、GroupBy の比較方法を1つに。useSmartFolderEditor.ts:185-189 のグループ分け変更時の replaceFolder を一覧の更新後に。LibraryView.tsx:110 の値候補の q の正規化を useGroupValuesQuery の中へ。userWorkStateRepository.ts:402-404 の通らない null 分岐を削除。reportedBrokenFolders を行の削除時に消す。smartFolderPermissions のコメントを壊れた行でも正確に。server テスト: smartFolders.test.ts:499,505 の年は addedAt を固定、:483 のテスト名を実装（読み→バイト順）に、smartFolderStorage.test.ts:149-159 の作り直し PUT は結果の中身も確認、condition.test.ts の NFKC のコメントを入力に合わせる。smartFolderRestoreSchema.createdAt を ISO に絞る。LibraryNavigationProvider.tsx の createElement を JSX に。
- 範囲外の気づき（master からの構造、未実測。まず再現テストで事実確認し、事実なら直す）: 絞り込みで0件の画面から「戻る」で選択つきのエントリーへ戻ると isNoResultsDueToFilter が前の画面の true のまま1回描画され、useLibrarySelectionCleanup が選択を外しうる。作品詳細で検索欄に入力すると replace で詳細のエントリーが library に置き換わる（「戻る」で詳細へ戻れるよう push にするのが筋か確認し、統括へ報告してから直す）。
<!-- SECTION:NOTES:END -->
