---
id: TASK-323
title: smokeのopenApp起動待ちのフレーキーを解消する
status: Done
assignee: []
created_date: '2026-08-12 17:43'
updated_date: '2026-08-17 20:22'
labels: []
dependencies: []
ordinal: 333000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
フルスイート実行時に client/tests/smoke/support.ts の openApp が .mle-col.is-axis の可視待ちで20秒タイムアウトすることがある。単体実行では3.1秒、再実行では1.7秒で成功するため実装の不具合ではなく、フルスイート実行時の起動タイミングに起因する一過性の失敗。timeoutを伸ばすのではなく、待機対象を確定的な状態にするか起動処理側のボトルネックを特定して解消する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 smokeフルスイートを3回連続実行してopenAppのタイムアウトが発生しない
- [ ] #2 待機条件がtimeout延長ではなく確定的な状態の待機になっている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
統括による再現検証（2026-08-18）: この環境では再現しない。task-323のworktreeで未修正のベースライン状態のまま、毎回 client/node_modules/.vite を削除して冷えた状態にしたうえで cd client && pnpm exec playwright test をフルスイート実行。負荷なし3回・CPU負荷下（yes プロセス8本並走、nproc=12）3回の計6回すべて成功し、openApp の .mle-col.is-axis 可視待ちタイムアウトは0回（所要36.7〜49.5秒）。

解消済みと判断する根拠: 本タスクの起票は2026-08-12、TASK-307によるsmoke webServerのログ待ちreadiness化（ADR-0020、コミット591d465）は2026-08-15で本タスクより後。それ以前のreadinessはTCPプローブで、WSL2 mirroredのループバックブラックホールと相まって『実際には応答できない状態でready判定』が起こり得た。『単体3.1秒・再実行1.7秒・フルスイートで20秒タイムアウト』という本タスクの観測は、スイート先頭のテストが未準備のサーバーを踏むという機構とよく整合する。

Cursorが作成した3変更（playwright webServerへのvite optimize前置き、vite.configのserver.warmup追加、openAppでのGET /api/settings待ちとURL到達待ち）は破棄した。実装者のnotesでも『テスト中に optimized dependencies changed. reloading は観測されず、主因とは断定しない』とあり仮説が未確認で、検証も残留プロセスのポート占有により代替ポートで行われ本体構成では未実行だった。再現しない事象に対する未確認仮説の変更を残すのはパッチワークにあたるため。
<!-- SECTION:NOTES:END -->
