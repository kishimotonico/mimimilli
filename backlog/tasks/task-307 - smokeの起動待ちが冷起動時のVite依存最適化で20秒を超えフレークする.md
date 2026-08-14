---
id: TASK-307
title: smokeの起動待ちが冷起動時のVite依存最適化で20秒を超えフレークする
status: To Do
assignee: []
created_date: '2026-08-11 11:20'
updated_date: '2026-08-14 16:28'
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
- [ ] #1 Vite依存キャッシュを削除した状態からのpnpm test:smokeが安定して通る
- [ ] #2 温まった状態のsmoke実行時間が悪化しない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
前提の見直しが必要。このタスクの根拠にしている「全体2.9分」は、Vite依存最適化ではなくWSL2 mirrored networkingのloopback black hole（4200-5200帯の未使用ポートへの接続が約2分ハングしfail-fastしない）である可能性が高い。

TASK-336の統合検証（2026-08-15）で、DEBUG=pw:webserver + ミリ秒タイムスタンプの実測により内訳が判明した。masterベースライン(34e5ac3)のsmokeフルスイート2.9分の内訳は「Viteポートへのプローブが2分15秒ハング + テスト実行35秒」で、Vite自体の起動は ready in 202ms、テスト実行時間は35秒。冷起動と温起動でテスト実行時間に有意差はなかった。

未使用ポートへのcurl実測: 4200-5200帯（smokeのポート導出レンジ）は--max-time 10まで沈黙してrc=28、59000番台は0.01秒でrc=7（接続拒否）。PlaywrightはwebServer起動前にURLへ疎通確認を投げるため、閉じたポートへの初回プローブがこれを踏む。発症は非決定的で、踏まない回は37.7秒で完走する。

対応方針を決める前に、このタスクのAC（Vite依存キャッシュ削除後の安定動作）が本当に守るべきものなのかを再検討すること。原因がblack holeなら対策候補（キャッシュのウォーム、初回bootTimeout延長）はいずれも的外れになる。
<!-- SECTION:NOTES:END -->
