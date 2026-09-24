# アーキテクチャレビュー 2026-09-20

本書は設計判断のためのレビュー資料です。現行仕様を変更する決定書でも、実装タスク一覧でもありません。対応の採否・作業管理は別途Backlogで扱います。

## 対象と結論

対象はmaster `119aef15fa640b97fcbd5c507ecbd98dde1db411`。当初の調査は `c768893c` の固定スナップショットで行い、master確定後に差分を読み直しました。差分はFilesのプレビュー用取得、スキャン通知、そのテストとタスク記録で、以下の設計評価は変わりません。

調査はコード、共有スキーマ、設計文書、ADR、既存タスクの静的な確認です。動作確認、テスト実行、性能測定、個別不具合の再現は行っていません。「具体例」は責務や変更範囲を説明するもので、実行によって確認した障害ではありません。参照先の行番号は上記commit基準です。

React / Hono / sharedの3パッケージ構成や、物理ファイル・catalog・userの分離を作り直すほどの欠陥は見当たりませんでした。今後の機能追加に備えるなら、クラスやフォルダーをさらに細かく分けることより、同じ判断を複数箇所で行っている部分を減らすのが有効です。

特に優先したいのは次の二点です。

- 正本の異なるデータを、更新コマンドでも分ける。
- 作品管理の操作と、その結果を画面データへ反映する責務を、一つの所有者へ集める。

## 維持したい構造

`mimimilli.json`を作品メタデータの正本、catalogを再構築可能な投影、user DBを再生履歴などの正本とする分離は、このアプリの外部編集・ファイル移動という性質に合っています。[ADR-0017](adr/0017-meta-source-projection-and-work-identity.md)のsource-first編集やidentity conflictの方針も維持するのが妥当です。

スキャンは[ScanUpsertBatch](../server/src/adapters/real/scanUpsertBatch.ts)で投影候補を保持し、最後に世代を公開します。前回レビューの「500件ごとに公開され、新旧世代が混ざる」という説明を現在の問題として再掲すべきではありません。DB更新も[ADR-0023](adr/0023-in-place-migration-simplification.md)に従う方式へ変わっています。

通常検索のSQL実装とcoreの参照実装は、実行方式が異なることに理由があります。[検索契約テスト](../server/tests/real/worksQueryContract.test.ts)も存在します。二系統というだけで共通の汎用クエリエンジンを追加する必要はありません。スマートフォルダーの候補抽出後の評価も、現時点の静的調査だけで性能上の欠陥とは判断しません。

依存方向の機械的検査、sharedの契約、再生状態機械、安定した作品・トラックIDなども有効です。ファイルの行数だけを根拠に分割や設計変更を勧めるものではありません。

プレイヤーも、現在のLibrary／Filesという二つの再生元を扱う範囲では、`PlaybackItem.source`とエンジン側の分岐で責務を追えます。前回提案された汎用的なPlaybackSessionへの置き換えを、今回の必須改善には含めません。将来Shellを切り替える際は、controllerを保持するProviderと、音源を所有するRuntimeの寿命を揃える条件を確認すればよく、今から再開・復元処理を増やす必要はありません。

## 指摘

### R1. metaとuser DBの分離が、作品更新APIで崩れている

優先度: 高。今回、更新契約の問題として具体化した指摘です。

`WorkPatch`はmetaに属する`title / tags / urls`と、user DBに属する`bookmarked`を一つのリクエストへ載せられます。routeはすべてのPATCHに`sourceRevision`を要求し、real実装はbookmarkだけの更新でもメタファイルを読みます。

根拠:

- `shared/src/api.ts:179`の`workPatchSchema`
- `server/src/routes/works.ts:100`のPATCH受付
- `server/src/adapters/real/workMethods.ts:156`の`patchWork`
- `client/src/features/library/ui/preview/WorkMetadataActions.tsx:65`付近のbookmark操作

この契約では、メタファイルを読めることやそのrevisionが、ユーザー状態の更新条件になります。今後評価、既読、個人メモなどを追加すると、ファイルの編集競合とは関係のない情報まで同じ条件に従わせることになります。混合PATCHではuserへの書き込みとmetaの確定も別工程であり、一つの成功・失敗として扱うには意味が曖昧です。

meta更新とuser状態更新を別コマンドに分けることを勧めます。meta更新の契約には`sourceRevision`を必須として定義し、bookmarkはresume・lastPlayedと同様にuser状態として更新します。詳細取得で両方をまとめて返すことは問題ありません。読み取りDTOの形に合わせて、書き込みまでまとめる必要はありません。

現在のUIは各項目を独立したmutationで送っているため、混合更新の問題が日常操作で必ず起きるという指摘ではありません。既存の分かれた操作をAPIの所有権へ反映する変更です。分散トランザクションや補償処理を加える必要はありません。

### R2. 作品管理とキャッシュ整合性の責務が画面ごとに分散している

優先度: 高。Work Managementの抽出自体は2026-08-12の前回レビューの既知提案で、今回は未解消の範囲を確認しました。TASK-465で対応する。

Library、Files、Scan、DLsiteが、それぞれ作品を変更し、その後にどの一覧・詳細・件数を更新するかを判断しています。Libraryの作品編集は表示中の軸、検索、ソートを必要とし、作品を編集する能力がLibraryの画面文脈へ結び付いています。

根拠:

- `client/src/features/library/model/useLibraryQueries.ts:272`の`applyPatchSuccess`
- `client/src/features/library/ui/preview/WorkDetailPatchScope.tsx:34`付近
- `client/src/features/scan/model/libraryInvalidation.ts:10`
- `client/src/features/dlsite/model/dlsiteInvalidation.ts:18`
- `client/src/features/files/ui/FilePreviewWorkActions.tsx:79`付近
- `client/src/features/scan/ui/scanModal/useInlineTitleEdit.ts:35`付近
- `client/src/entities/work/queryKeys.ts:1`

作品一覧、詳細、facet、DLsite通知はquery keyのrootも異なります。これは単独では不適切ではありませんが、無効化の集合を各操作が個別に知る現在の構造では、新しい集計や表示を追加するたびに更新経路を横断して調べる必要があります。`workPatchInvalidation.ts`の詳細な分岐も、画面側が検索結果への影響を追いかけていることの表れです。

meta編集、登録・登録解除、ID再採番、DLsite適用など、作品を変更するmutationの入口と、操作ごとに必要なキャッシュ更新方針を、共通のwork-managementモジュールへ集めることを勧めます。各画面には選択解除、遷移、表示などの判断を残します。DLsiteの取得ジョブやSSEの寿命管理まで移す必要はありません。モジュール名や配置は既存構成に合わせてよく、client全体を一度に改名する必要はありません。

共通モジュールは整合性のために必ず更新する範囲を所有し、query keyの階層化はその補助にします。表示中の軸・検索・ソートに応じた選択的patchや一覧resetは、Library側の表示最適化として分けます。その場合も、共通の更新方針を満たした上で再取得を省略する契約にし、共通モジュールがLibraryのnavigation型を参照する構造にはしません。何でも全ページ再取得する設計へ戻す提案ではありません。

既存の無効化helper、型によるPATCH項目の網羅性検査、query key factoryは有効です。ただし、全操作が同じ方針を通ることまでは強制していません。画面の追加に伴う変更箇所を減らすには、helperの追加より操作の所有者を集める方が効きます。

### R3. DataAdapterが入出力だけでなく、業務フローの境界になっている

優先度: 中。既存TASK-338の再確認です。新規タスクとして重複起票する内容ではありません。

`DataAdapter`は、ストレージや外部I/Oの差し替えに加え、登録、復旧、DLsite適用といった一連の操作をrealとfixtureへ分けています。そのため同じ共有型を実装しても、処理の意味まで共通になるわけではありません。

具体例は候補登録後の処理です。`SettingsAdapter.registerScanCandidates`は`onRegistered`を受け取り、realは作品ごとに呼びます。fixtureは同じメソッドでその引数を扱いません。appはcallbackをDLsite取得のenqueueへ接続しています。

根拠:

- `server/src/adapter/settings.ts:26`
- `server/src/adapters/real/scanCandidateSession.ts:60`
- `server/src/adapters/fixture/settingsScan.ts:98`
- `server/src/app.ts:56`

ここで問題にしたいのはcallback一つの修正漏れより、「登録後に何をするか」をadapter実装へ委ねる契約です。登録完了後の付随処理が増えるたびに、両実装を同じ順序・失敗条件で維持する必要があります。

候補登録の結果を受け、成功した作品をDLsite取得へ渡す共通のapplication serviceを置く方が単純です。登録後に一括して取得へ進む仕様なら、成功ID群を一回渡せます。途中から取得を始める仕様を残す場合も、その判断は共通フローが所有するべきです。

すべてを汎用Repositoryやイベントバスに置き換える必要はありません。まず登録・編集・適用など、両adapterで同じ意味を持つ操作を共有します。fixture固有のデータ生成や、SQLとメモリで異なる検索の実行方式は分かれたままで構いません。

### R4. ナビゲーションが複数の状態を相互同期する仕組みになっている

優先度: 中。前回レビューで既に指摘されており、未解消です。

画面mode、Libraryの軸・選択・検索、Filesの場所・選択、作品詳細IDを別々のatomへ置き、push/replaceの要求も別atomへ置いています。`useNavigationHistory`が全体を購読し、URLから個々のatomへ書き戻し、別のeffectでatom群からURLを再構成します。

根拠:

- `client/src/features/navigation/model/useNavigationHistory.ts:74`の購読とsetter群
- 同ファイル`:111`のURLからの適用、`:197`のURL再構成
- `client/src/shared/model/navigationHistoryAtoms.ts:12`
- `client/src/entities/library/model/navigationActions.ts:19`付近

新しいroute項目を追加すると、parse/serializeだけでなく購読、適用、再構成、effectの依存配列、各遷移操作まで変更が広がります。これは表示部品を分割しても減らない複雑さです。

型付きの`AppRoute`を一つの正本とし、`navigate(route, { replace })`とブラウザー履歴からの適用で更新する構造を勧めます。Jotaiを廃止する必要はなく、一つのroute atomと派生atomでも成立します。表示密度やpopoverなどURLと無関係な状態は分けたままにします。

現在のparse/serialize集約、遷移時のcommit要求、履歴テストは有効であり、現行が無秩序という評価ではありません。変更のたびに同期箇所を増やす構造を、状態の持ち方から減らす提案です。

### R5. 作品の配置形式を、利用側でパスの拡張子から推測している

優先度: 中。単一ファイル作品を含む現在のモデルに対する指摘です。

`physicalPath`はフォルダー作品ではディレクトリ、単一ファイル作品では音声ファイルを表します。しかし`isAudioWorkPath`はファイルシステムや登録済みの種別を見ず、末尾の拡張子で判定します。`workMediaRoot`はその結果でメディアの基準ディレクトリを変えます。

根拠:

- `shared/src/meta.ts:79`の`isAudioWorkPath`と`:85`の`workMediaRoot`
- `server/src/adapters/real/catalogSchema.ts:27`のlocation保存
- `server/src/adapters/real/workProbe.ts:41`
- `server/src/adapters/real/coverMediaMethods.ts:32`
- `server/src/adapters/real/workRegister.ts:118`

この推測は再生時間の取得、カバー配信、DLsite画像の保存、登録解除などへ波及しています。対応拡張子の変更が、既存作品のlocation解釈まで変える構造です。問題の中心は珍しいファイル名への個別対策ではなく、登録時に分かっていた配置の意味を後段で再推測していることです。

scan・登録の境界で配置を確定し、後段はその結果を使うべきです。現在の両形式ではメディアの基準ディレクトリを`metaPath`の親として扱えるため、まず保存済み`metaPath`から解決する小さなモデルを検討できます。形式による操作差が必要な箇所には`folder / audio-file`の判別型を渡します。

`physicalPath / metaPath / mediaRoot / kind`をすべて独立した永続列として増やすことは推奨しません。導出できる値は導出し、位置解決の責務を一か所へ閉じます。不整合な配置は推測で補わずエラーとして扱えます。

### R6. DLsiteの正本状態と取得結果が同じ型を共有している

優先度: 中。ADR-0017の区別を、契約と型へ反映する改善です。

ADRはmetaへ保存する連携状態と、cache由来の取得失敗を区別しています。一方、`metaFileSchema`はAPI向けの`dlsiteStateSchema`を使い、`error / not_found`や一時的なエラー項目も受理します。`toMetaDlsiteState`は同じ型を返しつつ不要項目をnullにし、投影時にはstatusを三状態へ読み替えます。

根拠:

- `shared/src/meta.ts:4`、`:31`
- `shared/src/dlsite.ts:13`
- `server/src/adapters/real/dlsiteProjection.ts:12`、`:18`、`:63`
- [ADR-0017のDLsite正本・投影](adr/0017-meta-source-projection-and-work-identity.md)

この状態では、どの情報をファイルへ保存してよいかを変換関数の規約で守る必要があります。連携状態や取得結果の項目を増やすほど、型が許す値と正本として有効な値の差が広がります。

meta専用の小さな型を設け、`rjCode / status(none, applied, skipped) / appliedTags`を持たせます。cacheと合成したAPI向けの状態は別型にします。既知項目へ非対応の状態値が入った場合は、通常読取りで別の意味へ丸めず、診断対象にする方針が合っています。未知の外部ツール用フィールドを保持する方針とは両立します。

現在も書き込み時の正規化はあり、すぐに一時エラーが正本へ漏れると断定するものではありません。ADRには旧状態を読めるようにする意図もあります。ただし、後方互換を維持しない今回の指針では、それを正本の恒久的な型に残す必然性は弱いと判断します。

## スキャンで先に決めたい境界

スキャンについては、上記とは別に「観測・投影」と「正本変更」の境界を確認する価値があります。`scanRegister.ts:112`から呼ぶ`syncDetectedRjCode`は、名前やタイトルから推測したRJコードをmetaへ書き戻します（`server/src/adapters/real/meta.ts:354`）。そのため投影処理を呼ぶことが、正本の追加変更も意味します。

推測したRJコードを取得候補として使うことと、それを正本へ保存することを分け、後者を登録承認・編集・DLsite適用へ集めると、スキャンの説明が単純になります。自動保存を製品仕様として残す場合は、その例外を明示した上で共通の正本変更処理へ集めるべきです。これは製品仕様の判断を含むため、確定した不具合としては扱いません。

## 既存タスクとの関係と判断の範囲

TASK-338の業務規則共通化はR3に対応します。TASK-448.1のGrid/List props整理、448.2のLibraryView分割、448.3のDLsite SSE切り出し、448.4のfinalizeScan一本化も既知です。今回の調査を理由に同じ内容を別タスクへ増やす必要はありません。これらの局所整理だけでは、R1・R2・R4の責務の分散までは解消しません。

前回レビューの全提案を、そのまま順に実装することも勧めません。すでに解消したものがあり、縦モジュールへの全面移行などは、まずR2の共通操作を抽出した結果で必要性を判断できます。行数削減自体を成果にせず、機能を一つ変更したときに同時に判断し直す箇所が減ることを目安にするのが適切です。

配布、LAN公開、認証、モバイルUIは今回の主対象ではありません。将来の構想を根拠に現在のローカルアプリへ汎用基盤を追加する提案はしていません。
