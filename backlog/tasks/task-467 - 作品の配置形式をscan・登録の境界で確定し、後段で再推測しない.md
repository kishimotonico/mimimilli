---
id: TASK-467
title: 作品の配置形式をscan・登録の境界で確定し、後段で再推測しない
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 07:22'
updated_date: '2026-09-25 14:58'
labels:
  - refactor
  - architecture
  - scan
  - register
dependencies: []
priority: medium
ordinal: 521000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
背景: 2026-09-20のアーキテクチャレビューのR5（文書は反映後に削除済み。git履歴を参照）。単一ファイル作品を含む現在のモデルに対する指摘。

現在のコード根拠:
- shared/src/meta.ts（isAudioWorkPath、workMediaRoot）
- server/src/adapters/real/catalogSchema.ts（location保存）
- server/src/adapters/real/workProbe.ts
- server/src/adapters/real/coverMediaMethods.ts
- server/src/adapters/real/workRegister.ts

isAudioWorkPathは末尾拡張子だけでフォルダー/単一ファイルを判定し、workMediaRootがその結果でメディアの基準ディレクトリを変える。この推測は再生時間取得・カバー配信・DLsite画像保存・登録解除に波及している。

決定事項（統括判断、新しいADRに記録する）:
- scan・登録の境界で配置形式を確定し、後段は拡張子から再推測しない。
- まず保存済みmetaPathから媒体の基準ディレクトリを解決する小さなモデルを検討する。形式差が必要な箇所にはfolder/audio-fileの判別型を渡す。
- physicalPath/metaPath/mediaRoot/kindを独立した永続列として増やしすぎない。導出できる値は導出する。
- 不整合な配置は推測で補わず、エラーとして扱う。
- 後方互換は維持しない。既存catalog/metaに残る旧解釈のデータへの移行が必要な場合、手動コマンド例をADRに残す。

R5とDLsite導線再設計（DRAFT-74/76）の重なりは薄い（配置形式の確定はDLsite取得とは別軸）。ただしworkRegister.tsはDLsite関連コードとも接続するため、実装順で衝突しないよう確認する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 新しいADRで配置形式(folder/audio-file)の判別モデル(metaPath起点の解決)・永続列を増やしすぎない方針・既存meta/catalogへの手動移行コマンド例を記録している
- [x] #2 isAudioWorkPath等の拡張子推測に代わり、登録・scan時点で確定した配置形式を後段(再生時間取得・カバー配信・DLsite画像保存・登録解除)が参照する
- [x] #3 配置が不整合な場合はエラーとして扱われ、推測で補わない
- [x] #4 workProbe・coverMediaMethods・workRegister関連の既存テストが通り、判別型による分岐をテストで縛る
- [x] #5 pnpm check && pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
設計の正は docs/adr/0032-work-placement-from-meta-path.md。コミットは下の C1〜C6 に分け、各コミットで pnpm check が通る状態にする。

C1 docs(adr): ADR-0032 を単独でコミットする。

C2 feat(shared): shared/src/workPlacement.ts を追加し、index.ts から export する。
- 型: WorkPlacement（{kind:"folder"|"audio-file"; metaPath; mediaRoot} の判別共用体）、WorkPlacementResolution（ok:true → placement・physicalPath / ok:false → placement・physicalPath=metaPath・message）
- 関数: workPlacementOf(metaPath)、resolveWorkPlacement(metaPath, meta: Pick<MetaFile,"playlists"|"defaultPlaylistId">)。純粋関数。区切りは / と \ の両方を扱い、組み立てには metaPath と同じ区切りを使う
- 文言の共通接頭辞「配置形式が不整合です: 」と、実体検査用の文言ビルダー（例 workPlacementNotAFileMessage）も同じファイルに置く
- テスト: server/tests/workPlacement.test.ts を新設（shared にテスト基盤が無いため）。folder / audio-file の解決、a の各分岐（トラック0件・2件・既定プレイリスト無し・file 不一致・区切り含み・音声拡張子なし・別プレイリストが別ファイル・別プレイリストが同ファイルの区間違いは ok）、Windows 区切りの metaPath

C3 refactor(server/real): 後段を WorkPlacement 引数に置き換える。
- workProbe.ts: trackFilePaths / liveFileProbeMap / cachedFileProbeMap の physicalPath: string → placement: WorkPlacement
- workRefresh.ts: detail.row.metaPath から workPlacementOf して渡す
- coverDto.ts: statCoverSource(placement, coverImage)、coverDtoFromColumns(workId, placement, ...)
- workRowMapping.ts: SummaryRow・RawWorkListRow・WorkRow に metaPath を追加。rowToSummary / rowToWorkListItem / rowToWork は workPlacementOf(row.metaPath) を使う（probe キーも mediaRoot から）。CoverLocationRow は {id, placement, coverImage}、MediaRootRow は廃止
- workQuerySql.ts の JOINED_WORKS_SELECT、workQueryRepository.ts の listSummaries・queryWorks・facetCoverVersions の SQL に works.meta_path を追加。ListSummariesResult に placements: ReadonlyMap<workId, WorkPlacement> を追加
- workMediaQueries.ts: getMediaRoot → getWorkPlacement(db, id): WorkPlacement | null（meta_path を SELECT）。getCoverLocation も meta_path を SELECT して placement を返す。WorkQueryRepository の同名メソッドも改名
- coverMediaMethods.ts: describeCover / locateMedia は placement.mediaRoot を使う
- coverSnapshot.ts: buildCoverSnapshot は result.placements から mediaRoot を得る
- catalogWorkRepository.ts（トラック再生時間の取得）: meta_path を SELECT し workPlacementOf(...).mediaRoot で probe cache を引く
- dlsiteApply.ts（2か所）: workPlacementOf(current.metaPath).mediaRoot
- workRegister.ts: resolveMetaDeletionPlan(workId, recordedMetaPath) にし、physicalPath からの拡張子フォールバックと folderMetaPathOf を削除。unregisterWork は getMediaRoot を呼ばない
- scanRegister.ts: physicalPathForMeta を削除。PreparedMeta（scanTypes.ts）に placement: WorkPlacementResolution を持たせ、prepareMetaEntries / prepareSingleMeta で resolveWorkPlacement を1回だけ呼ぶ。assembleWorkForUpsert・増分スキップ判定は placement.physicalPath を使う
- workEditSource.ts・workMethods.ts（207・227行付近）: physicalPathForMeta → resolveWorkPlacement(...).physicalPath
- 既存テスト（coverDto・coverSnapshot・listSummaries 等）の呼び出しを新シグネチャへ合わせる。期待値は変えない

C4 refactor(server/fixture): metaPath を導入し、isAudioWorkPath・workMediaRoot を shared から削除する。
- data.ts: FixtureWorkRecord = Omit<WorkSummary,"dlsite"> & { metaPath }。RAW_SEED_WORKS に metaPath を明示する（fanza/d00001.mimimilli.json など）。buildFsRoot の folder/file 分割は workPlacementOf(work.metaPath).kind
- bulkData.ts: 生成時に `${physicalPath}/mimimilli.json` を metaPath にする
- scenarios.ts・state.ts: FixtureAdapterOptions.works を Array<WorkSummary & { metaPath }> にする
- playback.ts: 形式は workPlacementOf(metaPath).kind で判定。単一ファイル形式のトラック file は physicalPath の basename（記録済みの音声パス）
- works.ts: getWorkRegisterPreview / createWork はfixtureのファイルツリー（resolveFsPath(buildFsRoot(...))）のノードで形式を決める。ディレクトリ → folder、音声名のファイル → audio-file、それ以外は null（real と同じ 404）。createWork はその時点で metaPath を作り、祖先登録判定も kind で行う
- settingsScan.ts registerScanCandidates: folder の metaPath を作る
- テストで FixtureWorkRecord / options.works を組み立てている箇所（smartFolderAxisFacetsContract・dlsiteApplyMissingFailedContract・workUnregisterMissing・adapterRulesContract ほか）に metaPath を足す
- shared/src/meta.ts から isAudioWorkPath・workMediaRoot と、不要になる pathBasename を削除

C5 feat(server): 配置の不整合を scan・登録の境界でエラーにし、契約テストを置く。
- real scanRegister.ts registerMetaFile: エラー判定の先頭に配置検査を置く。placement.ok=false なら message。audio-file で ok なら physicalPath を statSync し、ファイルでなければ workPlacementNotAFileMessage。フォルダー形式のディレクトリ実体（c）はメタを読めた時点で成り立つので検査を置かない
- fixture settingsScan.ts runPseudoScan・works.ts createWork: 各作品のプレイリスト（buildFullWorkFromState の playlists と defaultPlaylistId）を resolveWorkPlacement に通し、ok=false なら status="error"・errorMessage=message・physicalPath=resolution.physicalPath にする
- 契約テスト server/tests/workPlacementContract.test.ts（1本、real・fixture の2ケース）: 単一ファイル形式で既定プレイリストのトラックが2件のメタを用意し、adapter.scan() → getWork で status="error" かつ errorMessage が「配置形式が不整合です: 」で始まることを両 adapter で確認する。real は一時ルートに音声ファイルと <stem>.mimimilli.json を書く
- real 単体テスト（scanner.test.ts 等に追加）: b（音声がディレクトリ・存在しない）が配置エラーになる。フォルダー名が音声拡張子で終わる作品（foo.mp3/）がフォルダー作品として正しく probe・カバー解決される
- workRegister.test.ts / workUnregister.test.ts: 単一ファイル作品の登録・解除が通ることを確認（既存テストの期待値は変えない。拡張子フォールバックを直接検証するテストがあれば、名前と理由を報告して書き換える）
- docs/ARCHITECTURE.md に配置形式の記述があれば ADR-0032 に合わせて書き換える

C6 docs: レビュー文書を削除し参照を整理する。
- 削除: docs/architecture-review-2026-09-20.md、docs/specification-review-2026-09-20.md、docs/dlsite-flow-review-2026-09-21.md
- 参照整理: docs/README.md、ADR-0025・0027・0028・0029・0030・0031（関連欄のリンク）、HANDOFF 等を rg で洗い出して削除または書き換え（ADR は README の例外規定「参照先の削除」に当たる箇所だけ直す）
- backlog/ 配下の参照は触らず一覧で報告する（現時点: draft-76、task-338・448.1・448.2・451・465・466・467・468・469・470）

検証: 実装中は変更範囲のテスト（server の該当 test ファイル）だけを回し、最後に worktree で pnpm check && pnpm test を前景で1回。UI は変えないので smoke は不要。

エラー文言（接頭辞「配置形式が不整合です: 」、<meta> はメタファイル名）:
- <meta> の既定プレイリストにはトラックが1つだけ必要です（N件あります）
- <meta> のトラックが参照する <file> は、このメタファイルに対応する音声ファイルではありません
- <meta> のプレイリスト「<name>」が <audio> 以外のファイル（<file>）を参照しています
- <meta> が指す <audio> はファイルとして存在しません
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
設計方針（アドバイザー承認 2026-09-25）: 配置形式の正本は metaPath のファイル名（mimimilli.json=folder、<stem>.mimimilli.json=audio-file）。kind 列は足さず、mediaRoot は dirname(metaPath) で導出する。shared に判別型 WorkPlacement と純粋関数 resolveWorkPlacement(metaPath, meta) を置き、isAudioWorkPath・workMediaRoot は廃止する。後段（probe・カバー・DLsite画像・登録解除）は placement を受け取る。physicalPath 列は残すが、形式の判定には使わない（シグネチャで担保）。scan・登録の境界での不整合（a: サイドカーのトラックがちょうど1つでない、またはそのfileがサイドカー名から決まる音声ファイル名と完全一致しない、b: サイドカーの指す音声がファイルでない、c: folder metaのディレクトリ実体が無い）は、既存の error 機構で error にする。状態は増やさない。実体の存在確認は adapter 側で行う。fixture は FixtureWorkRecord に metaPath を持たせて同じ resolveWorkPlacement を通し、real と fixture の両方に不整合 error の契約テストを置く。ADR には手動検出コマンド例を bash と pwsh 7 の両方で書き、単一ファイルの自動検出は範囲外と明記する。統合ブランチ feat/placement-kind、作業ブランチ task/467。完了時に docs/architecture-review-2026-09-20.md・specification-review-2026-09-20.md・dlsite-flow-review-2026-09-21.md を削除し、参照を整理する docs コミットを含める。

段階2完了: C1 ADR→C2 shared→C3 real→ADR修正(fixture判定)→C4 fixture→C5 不整合検出と契約テスト→ADR修正(検出コマンド)→C6 レビュー文書削除。worktreeで pnpm check && pnpm test 通過（server 898 pass / client 1212 pass）。UI変更なしのためsmokeは未実行。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ADR-0032。配置形式の正本を metaPath のファイル名にした（kind 列は足さず、mediaRoot は dirname(metaPath) で導出）。shared に WorkPlacement・workPlacementOf・resolveWorkPlacement を置き、isAudioWorkPath・workMediaRoot・physicalPathForMeta と、登録解除の拡張子フォールバックを廃止した。後段（probe・カバー・DLsite画像・登録解除）は placement を受け取る。scan・登録の境界で配置の不整合を既存のerror機構でerrorにし、fixture も同じ関数を通す（real と fixture の契約テストあり）。メタのparse errorとidentity_conflictのパスは metaPath 基準に統一した。Codexの指摘5件は是正済み。レビュー文書3本は削除した。Files での単一ファイル形式の重複解消導線は TASK-472。検証: pnpm check・pnpm test（server 906・client 1212）・pnpm test:smoke（30件）通過。master f6fa1767 にマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
