---
id: TASK-511.6
title: 未登録タブで取得してから追加できるようにする
status: Done
assignee: []
created_date: '2026-11-19 00:24'
updated_date: '2026-11-19 05:15'
labels:
  - scan
  - dlsite
  - ui
dependencies:
  - TASK-511.1
  - TASK-511.2
  - TASK-511.3
  - TASK-511.11
references:
  - 'https://claude.ai/artifact/GbuEuRQyKeD9xN4CM3Fv1k'
documentation:
  - docs/adr/0033-dlsite-fetch-before-register.md
  - docs/adr/0034-scan-modal-restructure.md
parent_task_id: TASK-511
priority: high
ordinal: 575000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0033・ADR-0034の未登録タブをクライアントに実装する。取得ジョブ（TASK-511.1）のクライアント側の追跡（ジョブIDの保持、SSEの購読、再接続時のGETでの確定。ADR-0030の規則）もこのタスクで作る。現行は client/src/features/scan/ui/scanModal/UnregisteredTab.tsx。レイアウトの正は実装と docs/design-system.md、見た目はモック（ref）を参考にする。

文言と表示:
- ツールバー左に「すべて選択」と、選択した候補に対する「除外」（既存の POST /scan/candidates/exclude。行ごとの除外ボタンは置かない）。除外の取り消しは、現行の元に戻す操作（restoreScanCandidateExclusions、POST /scan/candidates/exclusions/restore）をツールバー化後も維持する。該当なし・失敗があるときだけ、テキストリンク「問題のあるN件だけ表示」/「すべて表示」（丸いピルは使わない）。
- ツールバー右に高さ固定の枠を置き、「DLsiteから取得」ボタン（横に小さく「N件・約M分」。目安は1件2秒）と、まとめての取得の進捗（「取得中 n / N」・細いバー・残り時間・「中止」）を同じ枠の中で入れ替える。一覧の位置は動かさない。
- 列: 選択 / カバー / タイトル / RJコード / DLsite / 操作。取得済みの行はDLsiteのタイトルを主に、フォルダー名を小さく添える。カバーは小さいサムネール（TASK-511.2の配信経路）。RJコードは押すとその場で直せる（直すと未取得に戻り、行末に「取得」）。RJコードが無い候補はRJコード欄を「—」。
- DLsite列: 未取得は空欄、取得中（作業中の色）、取得済み（完了の色）、該当なし・失敗（あなたの番の色）。アイコン＋文字で区別する。該当なしの行に「修正」（RJコード欄にフォーカス）、失敗の行に「再試行」。
- 起点（まとめて／単発）はproduct codeごとに付く（TASK-511.1）。上の枠の「取得中 n / N」と中止は、起点がまとめてのコードだけを扱う。単発の取得（再試行・修正後の取得）はその行の状態だけで進み、まとめての取得の最中でも枠の件数に入らない。中止しても単発のコードは止まらない。
- 行方不明の作品と同じRJコードの候補の行に、その作品のタイトルを添えた注記を出す。引き継ぐ操作はDRAFT-77で決めてから作るので、ここでは出さない。
- フッターは分割ボタン「N件を追加」＋▾。▾のメニュー「項目を選んで追加…」で、タイトル・カバー・タグ・URLのチェック（既定すべてON）と「N件を追加」の小さなポップオーバーを開く。取得中の候補は自動で除く。取得していないRJコードあり候補を含むときだけ、ボタン横に「うちM件はDLsite情報なし」。
- 行の高さとセルの縦位置をそろえる（入力欄と状態表示がずれない）。UIに説明文を置かない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 候補一覧は仮想リスト（client/src/shared/ui/useVirtualList.ts）で、1000件でも見えている行だけを描画する
- [x] #2 「DLsiteから取得」は選択中の候補のうちRJコードがあって未取得（TTL切れを含む）のものだけを対象にし、取得中は同じ枠が進捗と中止に入れ替わって一覧の位置が動かない。枠の件数と中止は起点がまとめてのコードだけを扱い、単発の取得では枠が変わらない
- [x] #3 DLsite列が空欄・取得中・取得済み・該当なし・失敗を出し分け、取得済みの行がDLsiteのタイトルとカバーを見せる。該当なしの「修正」と失敗の「再試行」が行の中だけで進む
- [x] #4 選択した候補をツールバーの「除外」で除外でき、行ごとの除外ボタンは無い。除外を元に戻す操作が今までどおり使える。行方不明の作品と同じRJコードの候補の行に注記が出る
- [x] #5 「N件を追加」が取得中の候補を除いて追加し、▾の「項目を選んで追加…」で反映項目を選べる。取得していないRJコードあり候補を含むときだけ「うちM件はDLsite情報なし」が出る
- [x] #6 追加すると新規作品タブに移り、モーダルを閉じて開き直しても、取得の進捗と結果が残っている
- [x] #7 pnpm test:smoke を含めて pnpm check・pnpm test が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-19（TASK-511.1の設計確定より）: 取得ジョブのAPIは POST /dlsite/jobs（productCodesは1〜1000件、上限はsharedの定数）、GET /dlsite/jobs/current、GET /dlsite/jobs/events、中止は DELETE /dlsite/jobs/:jobId/bulk。選択が上限を超えたら上限ごとに分割して連続POSTする（合流するので1本のジョブになる）。状態は queued|fetching|fetched|not_found|failed で、queuedとfetchingは画面では「取得中」に畳む。offlineのときPOSTは offline エラーで拒否される。行の更新はSSEのcodeイベントで行い、候補一覧の無効化は間引く（resolveがヒットのたびにHTMLをgunzipするため）。

2026-11-19（TASK-511.1のレビューより）: 511.1で旧クライアントの一括取得の追跡（dlsiteBulkStore・DlsiteBulkRuntime）とそのテストを削除した。新しい追跡を作るとき、次の性質をテストで縛り直す: 多重startの抑止、応答待ち中のresetでSSEを開かない、二重completeの無視、アンマウント時のclose、切断からの復旧、不正なイベントで固着しない、追跡外jobIdのGETでの確定（打ち切り後の GET /dlsite/jobs/current は null を返すので、追跡中のジョブがnullなら終わったとみなす）、409 root_reconfiguring、取得の進捗でApp全体が再レンダリングされない（旧 appRootSubscriptions のテスト）、終端時のキャッシュ無効化（旧 updateCachesAfterDlsiteBulkFetch の相当。候補一覧と同じRJコードの作品の詳細・一覧）。取得の対象は「選択した候補のうちRJコードがあって未取得のもの」（ADR-0033）で、その選び方は本タスクで決めて縛る。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
DLsite取得ジョブのクライアント追跡（dlsiteJobStore・DlsiteJobRuntime）を作り、SSE購読・再接続時のGETでの確定（遅れたGETで巻き戻さない）・終端での候補一覧と同じRJコードの作品の無効化を行う。未登録タブを作り直し、ツールバー（すべて選択・除外・問題のある件だけ表示）、取得ボタンとまとめての進捗・中止を同じ枠で入れ替え、仮想リストの行でDLsite状態・カバー・タイトル・修正・再試行・行方不明の注記を出し、分割ボタンで取得中を除いて追加（▾で反映項目）。SplitButton・StatusLabelを追加、Modalに幅960・高さ固定。候補にrjCodeEdited。あわせてFilesの再採番・登録解除の後処理をmutateAsync完了後へ移し、アンマウントで選択が残る不具合（smokeの約20%失敗）を直した。
<!-- SECTION:FINAL_SUMMARY:END -->
