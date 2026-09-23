---
id: TASK-451
title: スキャンとDLsite連携の現行フローを調査し再設計案をまとめる
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 22:51'
updated_date: '2026-09-23 17:49'
labels: []
dependencies: []
documentation:
  - docs/dlsite-flow-review-2026-09-21.md
ordinal: 505000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ユーザーのドッグフーディングで生じた混乱を、現行UI・内部契約・フィクスチャ実操作から調査する。DLsiteは任意、登録後すぐ再生できること、物理スキャンと外部取得の分離、ブラウザ非依存の長時間処理を前提に、仕様の比較と推奨案を作る。実装・仕様確定・コミットは行わない。未決の実装要件はDRAFT-47/DRAFT-63との関係を整理する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 現行の入口とユーザーフローをUI文言・コード根拠付きで整理している
- [x] #2 フィクスチャで通常系と失敗・再接続等を確認し、未検証範囲を明記している
- [x] #3 既存レビューの既知問題と追加発見・反証を区別している
- [x] #4 取得・適用・再試行・結果参照について推奨仕様と代替案を比較している
- [x] #5 ユーザーの確定方針・未決事項・土台設計との依存を区別している
- [x] #6 調査提案をdocsへ保存し、既存ドラフトとの対応と次の仕様判断をBacklogへ記録している
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. server/sharedとclient/UIを並行で静的調査する。
2. 専用worktreeのfixtureを実操作し、画面と状態の証拠を集める。
3. 確定要件を基にフローと状態・適用方式を比較し提案を作る。
4. 独立レビューで事実と提案を検証し、文書とBacklogへ整理する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
調査基準は a37dfd54（wip/astra-review-2026-09-21）。専用worktree .worktrees/task-451（docs/task-451-dlsite-flow）を作成。Sol mediumがserver/sharedの契約調査と仕様比較、Luna maxがclient/UI静的調査とfixtureブラウザ検証を担当。ブラウザ検証以外は読み取りで並行。成果はdocsに統合し、実装・コミットは行わない。

静的UI監査: DRAFT-47はRJコード確定と取得を1操作にまとめ、通信失敗時もコードを保持し、編集draftと独立適用を分ける方向。DRAFT-63はAPI不存在ではなく、内部snapshotはあるが常設の結果再訪・作品別結果・再試行UIが不足と整理。追加判断として、取得済み・未適用を未連携と分ける、skippedを取得待ち表示にしない、scanとDLsite取得を別レーンにする、自動取得と自動適用を分ける、bulk結果の保持期間とサーバー再起動後の扱いを決める必要がある。詳細は/tmp/mimi-dlsite-ux-audit.md。

fixture実操作（専用worktree .worktrees/task-451 / new-work / task-451-dlsite-flow.mimi.localhost:1355）で通常scan→候補登録→登録直後のコードなし再生、DLsite失敗一覧→単体取得・プレビュー・適用、bulk取得8件→未設定項目適用9件、通知・設定、reload・別タブ再接続を確認。スクショ5枚をdocs/assets/dlsite-flow-review-2026-09-21/へ配置し、相対リンク5件を確認。未検証は実DLsite・実DB、長時間進捗・取消・通信断・サーバー再起動・実音声品質。ffmpeg不足で動画は未取得。専用server/session停止済み。

訂正: DRAFT-47の『通信失敗時もコードを保持』は元draftの既存合意ではなく、今回の静的監査で追加した未採用の仕様提案。元draft上は未決として扱う。fixture適用後もnot_found/未連携件数が残るのは、fixture dlsiteMethodsが適用時にdlsite.statusを更新せず、works通知集計がstate.worksを直接集計するため。realはdlsitePersistがstatus=appliedを書いて投影するため、fixture残留をreal欠陥とは断定しない。

最終確認: docs/dlsite-flow-review-2026-09-21.md と docs/README.md は oxfmt --check を通過。文書内の証拠画像5枚の相対リンクを確認し、git diff --check も通過。変更範囲はdocs/README、調査提案文書、証拠画像、TASK451に限定され、ソース変更なし。フルtest・smokeは不要。

2026-09-22ユーザー採用: (1)通常の物理スキャンからDLsite取得を暗黙起動せず、登録時にコードあり作品をまとめて取得する明示選択を設ける。未選択時もDLsite専用管理ビュー/作品詳細から取得可能。(2)取得情報は差分確認後に明示適用し、一括承認を用意する。未設定のみの自動補完・外部情報への自動追随は採用しない。(3)復帰先はDLsite専用管理ビューとし、作品詳細の単体操作は残す。登録後即再生、DLsite任意、ブラウザ非依存は前提維持。選択の既定値、コード取得失敗時の保存、サーバー再起動後の再開、結果保持期間、管理ビューの配置は未決。全体レビュー担当へ: docs/dlsite-flow-review-2026-09-21.md は採用方向と未決細部を反映済み。実装・新規タスク・DRAFT編集は行わない。

2026-09-23追記: ユーザー指摘の「別途決める」6件は DRAFT-74「DLsite連携の残る利用者向け詳細仕様を決める」に集約した。1 登録時取得選択の初期値/前回記憶、2 専用管理ビューの入口/配置/レイアウト、4 server再起動後の扱い、5 直近取得結果の保持上限、6 一括承認の選択粒度/対象集合を未決として記録する。3 は差分確認後の明示適用＋一括承認を採用し、未設定のみの自動補完と過去値への自動追随を不採用とする決定済み。DRAFT-47は作品編集の保存モデル、DRAFT-63は一括取得結果API/refresh運用、TASK-460は最終取得失敗の寿命、TASK-461はDRAFT-63/66の前提修正を担当する。TASK-451のDoneは調査完了のまま維持し、仕様全決定・実装完了とは扱わない。

2026-09-24追記: DRAFT74の旧記述の読替: TASK-460=最終取得失敗の表示寿命、TASK-463=user DB単独復元時のcatalog整合。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
現行14論点とUI不一致、推奨フロー・比較、実操作/静的の区別、fixture固有不整合、未決仕様をDRAFT47/63と対応付け、実装/commitなし。fixture証拠5枚、相対リンク、oxfmt --check、git diff --checkを確認した。
<!-- SECTION:FINAL_SUMMARY:END -->
