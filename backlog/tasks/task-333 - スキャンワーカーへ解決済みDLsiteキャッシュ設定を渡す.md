---
id: TASK-333
title: スキャンワーカーへ解決済みDLsiteキャッシュ設定を渡す
status: Done
assignee: []
created_date: '2026-08-14 08:21'
updated_date: '2026-08-14 09:59'
labels: []
dependencies: []
priority: medium
ordinal: 343000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexレビュー2026-08-14（マージe9c16fbの事後レビュー）の指摘。scanWorker.ts:61がDLsiteキャッシュのパスをjoin(dataRoot, "db", "dlsite-cache.sqlite")に固定しており、MIMIMILLI_DLSITE_CACHE_DBで別パスを設定した環境では取得処理と別のDBを読む。TTL設定（ttlsMs）もワーカーへ渡っていない。resolveDlsiteCacheConfigで解決した設定をワーカー入力に含め、取得側と同じキャッシュを参照させる。影響はenvを設定した環境に限定される。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 MIMIMILLI_DLSITE_CACHE_DBを設定した環境で、スキャンの投影が取得処理と同じキャッシュDBを参照する
- [x] #2 TTL設定がワーカー側のDlsiteCacheにも適用される
- [x] #3 設定の受け渡しを検証するテストがある
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-08-14 08:25
---
検討2026-08-14: 影響範囲の狭さを理由に低優先としていたが、コスト・頻度ベースの判断はAGENTS.mdの方針に反する。サポート済みenvの正しさの問題であり、修正も小規模で設計論点がないため、TASK-331・332と同バッチで実施する。
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
scanWorker.tsがDLsiteキャッシュのパスをjoin(dataRoot, "db", "dlsite-cache.sqlite")にハードコードしており、MIMIMILLI_DLSITE_CACHE_DBを設定した環境ではスキャンの投影処理が取得処理と別のDBを読んでいた。TTL設定もワーカーへ渡っていなかった。DlsiteCacheにget config()を追加し、createRealAdapterが取得側で使っているインスタンスの解決済み設定をそのままワーカー入力へ通す形にした。環境変数の解決はserver/src/index.tsの1箇所のままで、ワーカー側での読み直しや新規フォールバックは追加していない。テストはoverride先にだけキャッシュを仕込みdefault pathを空のまま残す形で、ハードコードへ戻ると落ちることを実際に確認済み。レビュー指摘により、旧実装の唯一の利用箇所だったWorkerInput.dataRootの受け渡しチェーン（scanRunner・settingsScanMethods・index.tsのフォールバック算出を含む）を削除し、get configはttlsMsを防御的にコピーして返すよう修正した。検証: pnpm check通過、server 598 / client 811。
<!-- SECTION:FINAL_SUMMARY:END -->
