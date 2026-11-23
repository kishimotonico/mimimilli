---
id: TASK-518
title: smoke の高負荷時に起動待ちで落ちる原因を切り分ける
status: Done
assignee: []
created_date: '2026-11-23 12:50'
updated_date: '2026-11-23 20:40'
labels:
  - test
dependencies: []
priority: medium
ordinal: 631000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pnpm test:smoke を既定の並列で回すと、1回目だけ数本が起動待ちのタイムアウトで落ち、--workers=3 や再実行で通る現象が TASK-516 の間に何度も出た（毎回落ちるテストはばらばら、ベースでは再現しなかったこともある）。ポートの衝突（常駐 dev server・worktree パス由来のポート）、WSL2 の loopback の遅延（ADR-0020）、負荷による起動の遅れのどれかを計測で切り分け、原因に合った直し方を決める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 落ちたときの起動待ちのログ（ポート、待ち時間、その時点の ss -ltnp）が残る仕組みがある
- [x] #2 既定の並列で10回回した結果と、落ちた原因の内訳がタスクのメモに記録されている
- [x] #3 原因に対する修正が入り、既定の並列で10回連続して通る。または修正しない判断とその根拠がメモにある
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
計測と原因（task-518 ブランチ 88c63913）。ポート衝突・WSL2 loopback（ADR-0020）は原因ではなかった（落ちた回の ss -ltnp に衝突なし、bun 起動ログ待ち 0.4〜1.3s・vite 1.0〜4.1s）。原因は3つ。

1. 起動待ちの fixture timeout: workerServers の setup（bun→vite→warmUp）にテスト既定の30sが掛かる。フェーズ合計は通常約7s、loadavg35で約18s、CPU hog 48本で warmUp 単独 31〜34s。元コード+hog48本+Vite cache 削除で71本中21本が `Fixture "workerServers" timeout of 30000ms exceeded during setup`。fixture timeout 200s で同条件 0本。無負荷（cold cache でも）・hog16本では元コードも落ちない。ベースの1回目（7本落ち）は他 worktree 等の負荷が重なった回。
2. 再生バーの pointer-events: nowPlayingLayer.smoke:46 等で「再生中を開く」が main に遮られる。診断で .mle-bar1 の computed pointer-events:none が残っていた。useMotionVariants の exit が pointerEvents:"none" を持ち animate が戻さないため、退出が打ち切られ再入場すると残る製品バグ。hog16本で 6/24 失敗（無負荷 0/24）、animate に "auto" を足して 24/24。
3. クイックオーバーレイのホバー: library.smoke:122 の2回目の hover() でオーバーレイが開かない。無並行の clean 計測 c10 でも再現。計装ログで、値クリックの close() 後に行の triggerEnter が発火していない（パネルがポインタ直下で消えると React が pointerenter を取りこぼす）。hog16本で 6/40 失敗、トリガーに onPointerMove を足して 40/40。

計測（既定の並列4、各回 pnpm test:smoke 全71本）
- ベースライン1回目: 7 failed（nowPlayingLayer 3・RegressionGuards 1・unregisteredDlsite 3、全て上記1）
- 原因1の対処後 a1-a3（他 smoke なし）: pass / fail（nowPlayingLayer:46 = 原因2）/ pass
- b1-b10: b1 並行あり（517.9 smoke と自分の vitest、判定外）、b2 fail（library:122 = 原因3、517.9 重なり中で参考）、b3-b10 pass
- c1-c10（他 smoke なし）: c1-c9 pass、c10 fail（library:122 = 原因3）
- 3つ全て修正後 d1-d10（他 smoke なし）: 10/10 pass（各 122〜184s）
- 再現・確認は自作の CPU 負荷（hog 16/48本、終了時に停止）。pnpm check・pnpm test は通過。

診断: smoke の起動待ちで落ちたとき、待機フェーズ・待ち時間・ポート・loadavg・ss -ltnp がエラーメッセージに出る（fixtures.ts の StartupTrace）。

レビュー反映（追加コミット）。
- 起動の期限: bun 60s・vite 60s・warmUp 90s（launch/goto/要素待ちを1期限）＋余裕30s＝fixture timeout 240s。根拠は実測の最大（bun 1.3s、vite 4.1s、warmUp 34s＝CPU hog48本・Vite cache なし）の約2倍以上の余裕。フェーズ上限の合計より fixture timeout が長いので、診断付きの失敗が先に出る。起動後のエラーには診断を付けない（use() を catch の外へ）。
- shutdown が signalCode を見るようにし、シグナル終了した監督プロセスでも診断付きエラーが返る。
- pointer-events: 全 variant の exit の pointerEvents と fade の exitAbsolute を削除。useMotionVariants を使う全箇所（PlayerDock、FilterChipAddButton、GroupValuePopoverPanel、GroupValueQuickList、PreviewPaneSlide、FilesView、ScanSidebar×3、Toast、NowPlayingView/Immersive）が inert={!isPresent} を付けていることを rg で確認（Lightbox は initial/animate のみ、NowPlayingImmersive のバーストは pointerEvents なし）。ScanSidebar の fade 利用は class が既に absolute inset-0 で挙動は変わらない。ADR-0014 の exitAbsolute の節を削除。再計測: hog16本で nowPlayingLayer を24回 → 24/24 pass（修正前は 6/24 失敗）。
- ユニットテスト: useHoverGroupCoordinator に onPointerMove 2本（close後に move だけで200ms後に開く／move が続いてもタイマーを延ばさない。ガードを外すと後者が落ちることを確認）。useMotionVariants は exit/animate に pointerEvents を置かない形。
- 診断の実出力（warmUp の期限を一時的に1msにして発生、AC1 の証拠）:
TimeoutError: browserType.launch: Timeout 1ms exceeded.
[smoke起動診断] 待機中フェーズ: warmUp（実ブラウザの初回表示）（5ms 待機、開始から 1218ms）
完了済み: bunサーバー起動ログ待ち: 290ms, vite起動ログ待ち: 849ms
ポート: {"bun":45035,"viteStart":45959,"vite":45959}
loadavg: 1.2 4.8 12.1
ss -ltnp: LISTEN ... 127.0.0.1:45959 (MainThread) ほか
- d1〜d10 の10連続は「他の smoke なし」の計測で、同時実行での合否は未検証（別タスク候補）。
- 最終: pnpm check・pnpm test（client 1753、server 1369）通過、フル smoke 71/71。

既知の制限（対応しない）: Windows では監督プロセスが先に消えるとプロセスツリーのつながりが失われ、taskkill /T でも孤児の子を辿れない（直すにはジョブオブジェクト等が要り、smoke には割に合わない）。warmUp 成功後の browser.close 失敗は5秒で打ち切って無視する（warmUp 用ブラウザの後始末で、テストの正しさに影響しない）。

統括: Fable と Codex（mimi2）のレビューを通過（フェーズ上限と fixture timeout の整合、監督プロセスの終了後のグループ停止、pointer-events は inert に一本化、ホバーのテスト）。smoke の同時実行は TASK-520 に分けた。
<!-- SECTION:NOTES:END -->
