---
id: TASK-307
title: smokeのwebServer readinessをログ待ちへ変更しWSL2ループバックハングを回避する
status: Done
assignee:
  - '@fable'
created_date: '2026-08-11 11:20'
updated_date: '2026-08-14 18:47'
labels: []
dependencies: []
priority: low
ordinal: 317000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-251の修正(openAppの明示的な描画待ち、bootTimeout 20秒)後も、Vite依存キャッシュが無い冷起動の初回テストのみ起動待ちが20秒を超えて失敗することがある。2026-08-11のビュー軸再編マージ後の初回smoke実行で「ライブラリシェル: 軸レール・結果面・チップ列が表示される」が1回失敗(support.ts:30の可視待ちタイムアウト、全体2.9分)、直後の再実行では10/10パス(21秒)。温まっていれば安定。対策候補: webServerのreadiness確認をfixture APIだけでなくクライアントバンドルの初回変換完了まで広げる、smoke実行前にViteキャッシュをウォームする、初回テストのみbootTimeoutを延ばす、のいずれか。頻度は低い(キャッシュ破棄後の初回のみ)。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 client/playwright.config.ts のwebServer 2本がurl/port指定を持たず wait(stdout/stderr正規表現)方式で起動を待つ
- [x] #2 pnpm test:smoke が起動前プローブのハングなしで完走する(2分超の無言待ちが消え、複数回実測で全体所要がテスト実体+起動オーバーヘッドの範囲)
- [x] #3 温まった状態のsmoke実行時間が従来から悪化しない
- [x] #4 調査経緯と決定がADR-0020として記録されている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 実装担当(Sonnet)へ委譲: playwright.config.tsのwebServer 2本をwait方式へ変更(ポート導出はcommand/baseURL用に維持)。Bunサーバー/Viteそれぞれの起動完了ログ行をstdout/stderrのどちらに出るか実測して正規表現を決める
2. 検証: pnpm test:smoke を複数回実測しプローブハング消失を確認
3. ADR-0020を作成(WSL2 loopback blackhole調査の経緯と決定)
4. レビュー担当(Sonnet)が報告にない副作用をレビュー後、統括がmasterへ直接コミット(ユーザー承認済み: ブランチ/worktree不要)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
前提の見直しが必要。このタスクの根拠にしている「全体2.9分」は、Vite依存最適化ではなくWSL2 mirrored networkingのloopback black hole（4200-5200帯の未使用ポートへの接続が約2分ハングしfail-fastしない）である可能性が高い。

TASK-336の統合検証（2026-08-15）で、DEBUG=pw:webserver + ミリ秒タイムスタンプの実測により内訳が判明した。masterベースライン(34e5ac3)のsmokeフルスイート2.9分の内訳は「Viteポートへのプローブが2分15秒ハング + テスト実行35秒」で、Vite自体の起動は ready in 202ms、テスト実行時間は35秒。冷起動と温起動でテスト実行時間に有意差はなかった。

未使用ポートへのcurl実測: 4200-5200帯（smokeのポート導出レンジ）は--max-time 10まで沈黙してrc=28、59000番台は0.01秒でrc=7（接続拒否）。PlaywrightはwebServer起動前にURLへ疎通確認を投げるため、閉じたポートへの初回プローブがこれを踏む。発症は非決定的で、踏まない回は37.7秒で完走する。

対応方針を決める前に、このタスクのAC（Vite依存キャッシュ削除後の安定動作）が本当に守るべきものなのかを再検討すること。原因がblack holeなら対策候補（キャッシュのウォーム、初回bootTimeout延長）はいずれも的外れになる。

2026-08-15 解決編: 全帯域スイープ・境界二分探索・Windows起点試験・再起動の自然実験により機構を確定（正常応答はip_local_port_range(幅4096)内のみ、範囲は再起動で移動、ゲスト内部FSE起因、wsl --shutdownでも直らない）。対応としてwebServer 2本をwait(stdout正規表現)方式へ変更（Bun: /サーバーを起動しました/、Vite: /ready in/、いずれもstdout実測で確認）。検証: pnpm test:smoke 4回連続 36〜39秒・15/15パス（従来2.9〜5.2分）。負の検証: 不一致正規表現+timeout 10秒で明示的タイムアウト失敗を確認後復元。pnpm check全パス。詳細な調査経緯はADR-0020参照。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
smokeのwebServer readinessをHTTPプローブからログ待ち(wait.stdout)へ変更し、WSL2 mirroredのloopbackブラックホールによる2分超のプローブハングを解消した。reuseExistingServer削除、ポート衝突はstrictPort/bind失敗で顕在化。smoke 4回実測36〜39秒で検証、経緯と棄却案はADR-0020に記録。
<!-- SECTION:FINAL_SUMMARY:END -->
