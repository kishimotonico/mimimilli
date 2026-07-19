---
id: TASK-80
title: Playlist/Track IDの導入と.meta.json一括移行（バックアップ・冪等）
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 05:07'
updated_date: '2026-07-19 08:29'
labels: []
dependencies:
  - TASK-78
modified_files:
  - shared/src/work.ts
  - shared/src/meta.ts
  - server/src/adapters/real/metaIdMigration.ts
  - server/src/adapters/real/scanner.ts
  - server/src/adapters/real/catalogSchema.ts
  - server/src/adapters/real/workRepo.ts
  - server/src/adapters/real/db.ts
  - server/src/adapters/real/index.ts
  - server/src/index.ts
  - server/drizzle/catalog/0003_damp_roulette.sql
  - server/drizzle/catalog/meta/0003_snapshot.json
  - server/drizzle/catalog/meta/_journal.json
  - server/src/adapters/fixture/index.ts
  - client/src/app/App.tsx
  - client/src/features/library/ui/preview/WorkDetail.tsx
  - client/src/features/library/ui/preview/WorkInfoDialog.tsx
  - client/src/features/player/model/usePlayer.ts
  - server/tests/real/metaIdMigration.test.ts
  - server/tests/real/scanner.test.ts
  - server/tests/real/dbSeparation.test.ts
  - server/tests/workSchema.test.ts
  - server/tests/real/workRepoPersistence.test.ts
  - server/tests/real/worksQueryContract.test.ts
  - client/tests/unit/api.test.ts
  - client/tests/unit/dlsitePreview.test.ts
  - client/tests/unit/fullScreenPlayer.test.ts
  - client/tests/unit/usePlayer.test.ts
  - client/tests/unit/useWorkTagEditor.test.ts
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0008の実装第3弾。TASK-78が前提。

やること:
- shared契約: playlistSchema/trackSchemaにid（UUID v4）を追加、defaultPlaylistをdefaultPlaylistIdへ移行。end>start等の不変条件もsuperRefineで定義（doc-1指摘5）
- catalog DBにPlaylist/Track関係表を追加（再スキャンで再構築可能なcatalog分類）
- 既存.meta.jsonへのID一括付与の移行処理: (1)manifest先行採番による冪等な再実行 (2)書き換え前バックアップ (3)元ハッシュとも変更後ハッシュとも一致しないファイルは外部編集として上書きしない、の3要件（ADR-0008修正版の簡略化された手順に従う）
- スキャナの重複UUID処理を「事前列挙+正規化パス安定順で最初の1件が所有」へ置換（現行scanner.tsのその場ランダム再採番を廃止）

注意: .meta.jsonはユーザーの実ライブラリデータ。破壊的変更許容の方針でも、ここだけはバックアップと冪等性を必須とする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 新規スキャンでPlaylist/TrackにUUIDが採番され、meta・catalog関係表に反映される
- [x] #2 既存metaへの一括ID付与が冪等で、途中停止後の再実行が同じIDを使う（テストで検証）
- [x] #3 外部編集されたmetaファイルを上書きしない（テストで検証）
- [x] #4 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. manifestをパスMap索引・ライブラリ完了マーカー・100件単位の完了永続化へ改修する
2. 完了済み操作の元ハッシュ復元時に既存採番を再利用し、rename直前の再ハッシュで外部編集を保護する
3. Windowsの相対パスキーをケース非区別で正規化し、完了ライブラリはID軽量検査でハッシュ計算を省略する
4. Playlist名重複を許容する契約へ直し、巻き戻し・同名移行・競合窓・高速経路のテストを追加する
5. pnpm checkとpnpm testを通してTASK-80を再完了する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
スキャンのwalking直後、strictメタ読込前に独立移行を実行する。manifestはデータルートの migrations/playlist-track-ids/<library-root-hash>/manifest.json に置き、相対パス、元/変更後SHA-256、全採番ID、完了状態を記録する。バックアップは backup/<original-hash>/<relative-path> に保存する。未完了操作中に両ハッシュと一致しないファイルは外部編集として保護する。catalogのPlaylist/Track関係表はスキャンごとに再構築する。
検証: pnpm check 成功。pnpm test 成功（server 172件、client 244件）。

詳細レビュー6件の対応で再オープン。

レビュー対応: 完了済み操作も元ハッシュ一致時は既存採番を再利用する。操作索引をプラットフォーム正規化済み相対パスのMapへ変更し、manifestへlibraryCompletedを追加した。完了時はID存在・重複・元ID復元だけを軽量確認してメタSHA-256を省略する。完了状態は100件単位で永続化し、rename直前に元ファイルを再ハッシュする。標準fs APIでは再ハッシュとrename間の排他化はできないため、ごく短い競合窓が残る旨をコードコメントに記載した。Playlist名重複は許容する。
検証: pnpm check成功。pnpm test成功（server 176件、client 244件）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Playlist/Track ID移行をレビュー指摘6件に対応して改修した。元ハッシュ復元時の採番再利用、rename直前再検証、Map索引、ライブラリ完了高速経路、100件単位のmanifest完了永続化、Windowsケース非区別パスキーを実装した。同名Playlistを許容し、回帰テストを追加。全check/test成功。
<!-- SECTION:FINAL_SUMMARY:END -->
