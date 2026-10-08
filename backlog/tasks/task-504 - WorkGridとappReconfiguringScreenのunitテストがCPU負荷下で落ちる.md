---
id: TASK-504
title: WorkGridとappReconfiguringScreenのunitテストがCPU負荷下で落ちる
status: Done
assignee:
  - '@mimi2'
created_date: '2026-10-08 04:33'
updated_date: '2026-10-08 06:11'
labels:
  - test
  - flaky
  - client
dependencies: []
priority: medium
ordinal: 562000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-10-08 点検バッチの並走中（複数worktreeで pnpm test を同時実行）に観測。単体実行では通る。(1) client/tests/unit/WorkGrid.test.tsx の「renders far fewer tiles than total works for 1,000 items」が 5000ms でタイムアウト、同ファイルの列数確定テストも落ちた回がある。(2) client/tests/unit/appReconfiguringScreen.test.tsx で設定モーダルが見つからず落ちる。ログ: TASK-445 の連続10回実行（run-4/5/7）、TASK-486・TASK-498 のフルテスト。TASK-445 と同じく、同期点の誤りか重い処理の実測余白不足かを切り分ける。閾値の引き上げは構造的に短縮できないと示せた場合だけ。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 負荷を並走させたフルスイートで両ファイルが連続10回失敗ゼロ
- [x] #2 修正が閾値の引き上げではなく同期点の修正または処理の軽量化になっている（引き上げた場合は根拠がコメントにある）
- [x] #3 失敗時の期待値と実測値・所要時間が記録されている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
失敗時の実測(負荷下フルスイート10回中3回失敗): (1) appReconfiguringScreen「設定モーダルを開いたまま…」で getByRole('dialog',{name:'設定'}) が waitFor既定1000msに間に合わず(失敗時2.2〜3.5s)。無負荷でも設定モーダル初回描画の待機に約300ms、lazy importのモジュール変換に約200msかかる。(2) WorkGrid が完全飽和時に100件描画の通常テストまで6.3〜8.3sで5000msタイムアウト(列数確定・スクロール・onLoadMore計5件)。1,000件テストは無負荷318ms。原因: happy-domで仮想行のoffsetHeightが0になり、600px表示で本来約8行のところ39行(156タイル、100件では100タイル)を描画していた。修正: tests/unit/setup.ts のmockElementSizeで仮想グリッド行に高さ207を返し描画を32タイルに(1,000件テスト236→50ms、期待値は不変)。SettingsModalをbeforeAllで先読みし、設定モーダルを開く待機2箇所に timeout:5000 を付与(構造的に短縮不可の根拠をコメントに記載)。修正後: 負荷(CPU占有12プロセス+他worktree並走)下のフルスイート連続10回で1241件全pass。修正前同条件は10回中3回失敗。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
仮想グリッド行の高さを偽装して1,000件テストの描画を 156→32 タイルに減らし、設定モーダルの lazy import を先読み（待機の上限は初回描画が無負荷でも約300msかかるため5000ms）。負荷下のフルスイート連続10回で失敗ゼロ。 個別レビュー＋統合ブランチの横断レビュー、master への仮マージで pnpm check・test（client 1273 / server 951）・smoke 30 全通過（smoke はポート衝突の無い別パス worktree で実行）。9939fe4d で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
