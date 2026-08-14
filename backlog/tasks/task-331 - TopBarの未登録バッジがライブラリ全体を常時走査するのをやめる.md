---
id: TASK-331
title: TopBarの未登録バッジがライブラリ全体を常時走査するのをやめる
status: Done
assignee: []
created_date: '2026-08-14 08:20'
updated_date: '2026-08-14 09:58'
labels: []
dependencies: []
priority: high
ordinal: 341000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexレビュー2026-08-14（マージe9c16fbの事後レビュー）の指摘。TopBar.tsx:49のuseQueryがGET /scan/candidatesを呼び、real adapterのlistCandidates（scanner.ts:369）は毎回walkPhaseでライブラリ全体を再帰走査する。react-queryのデフォルト設定のため、アプリ起動時とウィンドウフォーカス再取得のたびにスキャンジョブ外でフルI/Oが発生し、大規模・ネットワーク配置のライブラリで高負荷になる。バッジ件数は明示的なスキャン・候補操作の結果から導出し、暗黙のフル走査を排除する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 TopBarのバッジ表示がライブラリ全体のファイルシステム走査を伴わない（前回スキャン結果・保存済み件数などから導出する）
- [x] #2 スキャン完了・候補の登録・除外・除外解除の後にバッジ件数が追従する
- [x] #3 ウィンドウフォーカスの出入りでlistCandidatesのフル走査が発生しないことを確認できるテストまたは計測がある
- [x] #4 pnpm test:smokeが通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TopBarのバッジがGET /scan/candidatesを常時購読し、real adapterのlistCandidatesが毎回walkPhaseでライブラリ全体を再帰走査していた。listCandidatesを直近スキャン結果のプールから返す形にし、走査はscan()時のみとした。プールには除外前の全件を保持し、除外フィルタは読み出し時に適用する。クライアントはキャッシュとGET /scan/lastからバッジ件数を導出し、ネットワーク取得は候補操作時のみとした。レビューで、worker経路（DB kind=files、本番の既定）だけがフィルタ済みの候補をプールへ入れており、除外中に再スキャンすると除外解除しても候補が復活しない退行を検出したため、両経路の意味論を除外前の全件へ揃えfiles-kindの回帰テストを追加した。候補プールはworker境界の内部型FileScanWorkerResultへ留め、HTTP/SSE契約のScanResultには載せない。worker出力メッセージは判別可能ユニオンへ統一し、非nullアサーションとフォールバックを除去した。検証: pnpm check通過、server 598 / client 811、smoke 15件全通過。
<!-- SECTION:FINAL_SUMMARY:END -->
