---
id: TASK-447.1
title: feat/ui-ux-intakeから「戻す」判定のUI変更をrevertで取り除く
status: Done
assignee: []
created_date: '2026-09-11 00:51'
updated_date: '2026-09-11 01:19'
labels:
  - ui
  - ux
  - triage
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 469000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-447 の判定で「戻す」になった変更を、統合ブランチ feat/ui-ux-intake 上でタスク単位の revert コミットとして取り除く。順序は 438 → 429（背表紙のみ）→ 430 → 428.22 → 428.4（部分）→ 428.15（部分）。コミット対応は tmp/uiux-triage-2026-09-11/inventory.md、原因調査は tmp/uiux-triage-2026-09-11/flicker.md・gridsize.md。UI 変更は後から戻し直せるよう、1タスク1コミット（部分戻しも1コミット）を守る。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 438・430・428.22 がそれぞれ1つの revert コミットで取り除かれ、428.9 の resultsBanner 描画集約（430前提）と 428.14 の useLibraryQueries.ts 変更が壊れずビルドできる
- [x] #2 429 は折り畳み帯の背表紙（AncestorStack と 63cb7fd/0eb2386/9106959、439 が触れた AncestorStack 部分）だけが1コミットで戻り、アドレスバーのパンくず中間省略（e851424/61c9d46/2d2636c）は残っている
- [x] #3 428.4 は ID重複（identityConflicts）時のUIだけが master の表現へ1コミットで戻り、要対応タブ・通知ベルのUIと 0414a51/bf98af4 のサーバー機能は残っている。errors シナリオで ID重複の確認導線が404にならず、DataIntegrityWarningBanner が表示される（435 AC#4）
- [x] #4 428.15 は不正URLの自動復帰（libraryUrlRecovery.ts、LibraryView の復帰処理、libraryInvalidUrlToastAtom と GlobalToast の該当経路）だけが1コミットで戻り、検索 Escape とパンくず改善は残っている。不正URLは404表示のまま
- [x] #5 1440x900・fixture large で作品詳細を選択中のグリッドが master と同じ6列・タイル幅181.5pxになり、詳細表示時のちらつきが無いことを flicker.md / gridsize.md の手順で数値確認している
- [x] #6 各 revert で削除・変更されたテストを revert ごとに一覧化してタスクメモに記録している
- [x] #7 pnpm check && pnpm test と pnpm test:smoke が通る
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 各revertのテスト変更一覧（AC#6）

### TASK-438（プレビュー全幅オーバーレイ）
- 削除: client/tests/unit/usePreviewOverlayMode.test.tsx（対象機能ごと削除）

### TASK-429（AncestorStack背表紙のみ）
- 削除: client/tests/unit/ancestorSpine.test.ts（buildAncestorSegments自体を削除したため）
- ADR-0014から「省略メニューのラッパー例外」「useIsPresentの4つ目の用途」の2節を削除（TASK-429固有の記述）

### TASK-430（余白算出・--topbar-h）
- 削除: client/tests/unit/playerPopupDockedLayout.test.tsx（機能ごと削除）

### TASK-428.22（軸レール件数・識別情報）
- axisDefinitions.test.ts等: 該当テストなし（fixture heavy機能のためテストは実質useLibraryQueries経由、UT新設なし）

### TASK-428.4（ID重複UIのみ部分戻し）
- client/tests/unit/needsAttentionTab.test.tsx: 「ID重複はworkId単位1行にまとめ...」「「別作品として取り込む」は確認後にreassignIdentityConflictを呼び...」の2ケースを削除し、「ID重複はパスごとに1行で表示し、Filesで開く導線を示す」に置き換え（パス単位・Filesで開くのみを検証）
- client/tests/smoke/library.smoke.spec.ts: 「スキャン完了後に候補を選択登録でき、問題をFilesで確認できる」のID重複行アサーションを2行1行（登録中:/重複:併記）からパス単位2行（workId:/競合相手）へ書き換え

### TASK-428.15（不正URL自動復帰のみ部分戻し）
- 削除: client/tests/unit/libraryUrlRecovery.test.ts（resolveInvalidLibraryAxisMessage自体を削除したため）
- client/tests/unit/axisDefinitions.test.ts: isRegisteredFacetAxisのテストケースを削除（関数自体を削除）
- client/tests/unit/libraryNavigationActions.test.ts: recoverInvalidLibraryAxisAtomのdescribeブロックを削除（atom自体を削除）
- 検索Escape/Enter・パンくずのスマートフォルダー名表示（topBarSearch.test.ts、LibraryBreadcrumbs.test.tsx、libraryAddressPath.test.ts）は無変更のまま全パス

残すタスクのテスト期待値は変更していない（削除・緩和なし）。428.4のsmoke修正は「戻す」判定でUIを変えた結果に合わせた必要な書き換え。

## 428.4部分戻しで特定した範囲
b7c6b51のNeedsAttentionTab.tsx/needsAttention.ts差分のうち、identityConflicts関連のみ:
- 戻した: workId単位1行への集約、「別作品として取り込む」ボタン、reassignIdentityConflict呼び出し・ConfirmDialog（features/scan/api.tsのreassignIdentityConflictも未使用化のため削除）
- 残した: needsAttention.ts本体（buildNeedsAttentionRows/countNeedsAttention、他kindのUI）、通知ベル・スキャン完了トースト等の統一表示、0414a51（DLsite一括enqueue）・bf98af4（lastScanRootFolder）
- features/files/api.tsのreassignIdentityConflict（Files側の既存導線、428.4より前から存在）はそのまま残存

428.9・428.14との整合: useLibraryQueries.tsのfacetAxisCountQueries/smartFolderCountQueries削除後もfilterValidFacetItems等428.14の無条件集計ロジックは無傷。resultsBanner描画のLibraryView側1箇所集約（428.9）はTASK-430revert後も機能を維持（430前提コメントのみ整合）。

## 実機での数値確認（AC#5）
worktree dev:fixture:large、1440x900、agent-browserセッションimpl-447-1で計測（URL: http://447-1.mimi.localhost:1355、事前にURL自体で自worktree確認済み）。
- /library/all グリッド表示、作品詳細未選択: 6列 × 181.5px（gridTemplateColumnsで確認）
- 作品詳細選択中も列数・タイル幅は変化しない（TASK-438 revertによりプレビューは絶対配置オーバーレイに戻ったため、選択有無でレイアウトに影響しない設計）
- ちらつき: 作品クリックからのrAFフレーム計測（0〜1.5秒）で.mll-results__content幅は1192pxのまま完全に不変、プレビューのみt=68msでマウントしtransformでスライドイン。TASK-438由来の「一覧が一瞬詰まる→遅れてプレビューが追いつく」現象は解消

errorsシナリオ（dev:fixture:errors）: DataIntegrityWarningBannerはスマートフォルダー軸選択中のみ描画される設計のため、検証用に一時スマートフォルダーを作成して確認（「1件の作品がデータ不整合のため除外されました」表示を確認後、削除済み・DB永続化なし）。
new-workシナリオ（dev:fixture:new-work）: スキャンダイアログ要対応タブでID重複がパス単位2行表示になっていること、「Filesで開く」でcopies/側パスが404にならず開けること（TASK-435と噛み合う）を確認。

## check / test / smoke
- pnpm check: 全通過
- pnpm test: 1087 pass / 0 fail（server real含む）
- pnpm test:smoke: 25 pass（library.smoke.spec.tsのID重複アサーションを修正して通過）

## 未チェックのAC・判断に迷った点
- AC#6は本メモで記録済みのためチェック
- 判断に迷った点: TASK-430revert内の4a91c69（task-430.mdのAC番号巻き戻し）をrevertに含めるべきか迷ったが、指示のコミット対応表に明記されていたため含めた。結果としてbacklogのtask-430.md AC記述が旧番号（分離前）に戻っている。TASK-447本体側で問題なければそのままでよいが、必要なら統括側でtask-430を確認してほしい
- git revert時にbacklogタスクファイル（task-430.md, task-428.22.md）のupdated_dateでコンフリクトが複数回発生。日付は古い方（revert対象コミットより前の値）を採用して解消（メタデータ自体の意味は変えていない）
<!-- SECTION:NOTES:END -->
