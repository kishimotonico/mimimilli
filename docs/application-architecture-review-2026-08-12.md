# アプリケーション設計レビュー 2026-08-12

Status: 暫定。今後の仕様判断に使うレビュー資料であり、現行仕様の正典ではない。

## 目的と前提

この文書は、機能を増やす前にmimikagoの製品境界、データ設計、クライアント構造を見直すためのものです。細かな不具合やOSS運用は対象にしません。

レビュー後の確認により、次の方針を固定条件とします。

- 物理ファイルと`mimimilli.json`が作品メタデータの正本である
- 外部アプリによる`mimimilli.json`の編集をSQLiteへ取り込める
- 作品フォルダーの移動を検出し、同じ作品として追従する
- FilesはLibraryと並ぶ主要機能であり、削除・縮小しない
- 未登録ファイルもFilesから閲覧・再生できる
- DLsite連携は重要な機能として維持・拡充する。ただし自動適用は見直せる
- 複数プレイリストは維持する
- スマホ向けUIは比較的近いうちに実装する
- 別端末からの接続方式は未決であり、スマホUIとは分けて判断する

以前のレビューに含めた「Filesを取り込み画面へ縮小する」「SQLiteを作品メタデータの正本にする」「複数プレイリストを削除する」という提案は撤回します。

## 推奨する全体構造

```text
物理ファイル + mimimilli.json（作品メタデータの正本）
              │
              │ scan / watcher / explicit edit
              ▼
catalog.sqlite（検索・一覧・診断用の再構築可能な投影）
              │ Work ID
              ▼
user.sqlite（resume・履歴・bookmark・ユーザー設定の耐久正本）

client
  Workspace ── Work Management ── Catalog
       └──────── Playback ─────────┘
                  │
              Navigation
```

ここでのWorkspaceは現在のFilesに相当します。単なるファイラーではなく、物理階層、未登録ファイル、sidecarの状態、作品登録、修復を扱うコンテキストです。Catalogは現在のLibraryに相当し、同じ作品を検索・分類の座標から扱います。

WorkspaceとCatalogを統合する必要はありません。共有すべきなのは作品編集と再生基盤であり、物理ブラウズとカタログ検索の画面・状態・queryは分けたままにします。

## 優先度の高い改善

### 1. user DBを自動再作成しない

`user.sqlite`にはresume、履歴、bookmark、スマートフォルダーなど、物理ファイルから復元できない情報があります。現在は独自のschema versionが一致しない場合にDBを退避し、空DBを作成します。[db.ts](../server/src/adapters/real/db.ts#L100)では、この処理をuser DBにも適用しています。[db.ts](../server/src/adapters/real/db.ts#L191)

更新契約を次に統一します。

- user DBはforward-only migrationだけを使う
- user DBの自動再作成を禁止する
- migration journalを世代管理の正本にする
- migration前にSQLiteの論理スナップショットを作る
- スナップショットを別データルートで開き、`integrity_check`と現行schemaでの読み出しを確認する
- migration失敗時は旧DBを保持したまま起動を止める
- catalogだけを削除・再構築可能にする

現行のバックアップは、開いたWAL DBの本体、WAL、SHMを順番にコピーしています。[dbBackup.ts](../server/src/adapters/real/dbBackup.ts#L48) `VACUUM INTO`またはSQLite Online Backupへ置き換える必要があります。

これは他の設計変更より先に行うべきです。

### 2. sidecarからSQLiteへの一方向投影を徹底する

現在は同じ作品情報を、sidecar、`works`の列、`playlists_json`、`playlists`、`tracks`、`work_tags`などへ保存しています。[catalogSchema.ts](../server/src/adapters/real/catalogSchema.ts#L12) アプリからの編集では、catalog更新とsidecar書き込みを同じSQLite callback内で行っています。[workMethods.ts](../server/src/adapters/real/workMethods.ts#L89)

SQLite transactionはファイル書き込みをrollbackできません。そこで、書き込み方向を次に統一します。

```text
外部編集 ─┐
          ├─ mimimilli.jsonへ確定 ─ catalogへ再投影
アプリ編集 ┘
```

アプリ編集はsource-firstにします。

1. 編集画面の取得時に`sourceRevision`を返す
2. 更新時に`sourceRevision`を必須にする
3. 現在のsidecarと一致しなければ`409 source_changed`を返す
4. 未知フィールドを保持したままJSONへpatchする
5. uniqueな一時ファイルへ書き、fsync後にatomic replaceする
6. 確定したbytesから、その作品だけをcatalogへ再投影する

catalog更新に失敗してもsidecarが正しい状態として残り、次回scanやwatcherで収束できます。catalog-firstの更新経路は廃止します。

catalog内では検索に適した正規化表を使いますが、それらはすべて投影です。`playlists_json`と関係表の二重投影はやめ、PlaylistとTrackは関係表から組み立てます。DLsiteの取得失敗、最終試行時刻、HTTP状態なども正本へ書かず、削除可能なcacheへ置きます。

### 3. 移動追従とidentity conflictを仕様化する

Work UUIDを作品identityとし、絶対パスは現在観測されたlocationとして扱います。Work UUIDはsidecarに保存済みです。[meta.ts](../shared/src/meta.ts#L14)

期待する挙動は次の通りです。

- 作品フォルダーを丸ごと移動した場合、同じWork IDのlocationを更新する
- root外へ一時的に移動した場合、catalogではmissingにするがuser状態は保持する
- 同じWork IDが1か所だけで再発見された場合、同じ作品として再接続する
- sidecarだけを複製した場合、routine scanで自動修復せず`identity_conflict`として表示する
- 「別作品として取り込む」という明示操作だけが複製側のWork IDを再採番する
- 音声だけを移動してsidecarの相対パスが古い場合、推測で追従せずbroken referenceとして表示する

現在の重複ID修復は、パスの自然順で所有者を選び、後続sidecarのIDを書き換えます。[duplicateMetaIdRepair.ts](../server/src/adapters/real/duplicateMetaIdRepair.ts#L68) コピー先の並び順によって元作品のidentityを奪えるため、正本をscanが自動変更する処理は廃止した方が安全です。

Playlist IDとTrack IDはWork配下のローカルidentityとして扱えます。catalogの主キーを`(work_id, playlist_id)`、`(work_id, playlist_id, track_id)`にすれば、作品フォルダーを複製したときの衝突修復をWork IDだけに限定できます。複数プレイリストの機能は維持できます。

sidecarには`formatVersion`も必要です。外部編集可能な長寿命の正本なので、parserの互換性とデータ形式の世代を区別します。後方互換レイヤーを常設せず、非対応versionは診断表示し、明示migration commandで変換する方針が合っています。

### 4. 変更検知のrevisionを分ける

現在のfingerprintは物理パスを含み、未知フィールドや一部のDLsite状態を除外し、media確認もdefault playlist中心です。[fingerprint.ts](../server/src/adapters/real/fingerprint.ts#L44) 外部編集の競合検知と再投影判断を一つのhashで兼ねるのは難しい状態です。

次の三つへ分けます。

- `source_revision`: sidecarのexact bytes。外部編集検知とCASに使う
- `projection_revision`: `formatVersion`、parser version、検証済みフィールド。投影ロジック変更の検出に使う
- `media_revision`: 全Playlistが参照する音声、coverの相対パス、存在、size、mtime。物理資源の変更検知に使う

locationはrevisionに混ぜず、独立した観測値にします。filesystem watcherはscanを早めるヒントとして使い、periodic/full scanを最終的な整合手段にします。

### 5. scanを発見、検証、公開へ分ける

自動登録とDLsite自動適用は廃止候補ですが、scan自体は物理ファイルを正本とするアプリの中核です。

推奨フローは次です。

1. Discover: sidecarと物理資源を列挙する
2. Resolve identity: 継続、移動、新規、重複、missingを分類する
3. Build staging: JSON検証、media stat、duration probe、投影行の生成を行う
4. Review: 未登録候補、重複、不正sidecar、外部変更をユーザーへ提示する
5. Validate: publish直前に`source_revision`を再確認する
6. Publish: catalogの作品投影、診断、presence、scan generationを一つのtransactionで公開する
7. Optional enrichment: ユーザーが選んだ作品だけDLsite取得へ進める

現状は500件ごとに公開catalogへcommitし、missing確定だけ最後に実施します。[scanUpsertBatch.ts](../server/src/adapters/real/scanUpsertBatch.ts#L46) キャンセルや失敗時には新旧世代が混在します。I/Oとparseはtransaction外で行い、完成した差分だけを短いtransactionで公開します。

読み取れなかったsubtreeの作品はmissingへ落とさず、`unverified`として旧投影を維持します。scan中にsidecarが変わった作品も今回のpublishから外し、次回対象にします。

未登録候補が多い場合は、候補一覧で「全件登録」「条件に合うものだけ登録」「例外だけ除外」を選べるようにします。自動登録と同程度の操作量を保ちながら、正本を書き換える前に結果を確認できます。

## Filesを維持するクライアント設計

### WorkspaceとCatalogを別コンテキストにする

現在のFilesは、物理FSだけでなく作品との対応付けも行っています。`FsEntry`には`workId`と`workRelPath`が含まれ、serverのbrowse処理が所有作品を解決しています。[fs.ts](../shared/src/fs.ts#L4)、[fsBrowse.ts](../server/src/adapters/real/fsBrowse.ts#L38)

これを`file-system entity`と`files feature`へ分けるより、Workspaceという縦moduleとしてまとめます。

```text
client/src/modules/
  navigation/       # typed routeとhistory
  workspace/        # 物理browse、viewer、sidecar診断、登録・修復
  catalog/          # 検索、分類、一覧、保存済み検索
  work-management/  # Work取得・編集・sidecar書き戻し・DLsite適用
  playback/         # session、controller、engine、resume policy
  scan/
  settings/
```

各moduleは`index.ts`の公開APIだけを外へ出し、module外からのdeep importを境界checkerで禁止します。`app`はprovider、shell、compositionだけを所有します。

Workspace上の資源は、単なる`workId | null`では足りません。次のような判別unionで管理状態を返します。

```ts
type WorkspaceManagementState =
  | { kind: "unmanaged" }
  | { kind: "managed"; workId: string }
  | { kind: "inside-managed-work"; workId: string; relativePath: string }
  | { kind: "orphaned-sidecar" }
  | { kind: "invalid-sidecar"; diagnostics: Diagnostic[] }
  | { kind: "identity-conflict"; workId: string };
```

Filesはsidecar正本の管理画面でもあるため、不正sidecarやidentity conflictを登録ボタン押下後に初めて見せるのではなく、一覧・inspectorの第一級状態として表示します。

### 未登録viewerをWorkspace resourceへ統一する

現在、未登録ファイル専用の配信は音声だけです。[media.ts](../server/src/routes/media.ts#L34) 画像は登録済み作品と相対パスが分かる場合に限られ、PDF、text、videoは未対応表示です。[FilePreview.tsx](../client/src/features/files/ui/FilePreview.tsx#L100)

`WorkspaceResourceRef`を受ける汎用media APIへ統一します。

```ts
type WorkspacePath = string & { readonly __brand: "WorkspacePath" };
type WorkspaceResourceRef = { kind: "workspace"; path: WorkspacePath };
```

serverがroot内の安全な絶対パスへ解決し、MIME、Range、サイズ上限、preview capabilityを判定します。clientは絶対パスを保持しません。WorkspacePathはroot相対で、separatorを正規化したportable pathにします。

音声、画像、PDF、video、textで転送方法が異なる点はserver adapterに閉じます。clientとserverがそれぞれ拡張子から種別を推測するのではなく、sharedの`MediaKind`と`PreviewCapability`を契約にします。

### 再生エンジンと再生元の方針を分離する

Filesの即席フォルダーqueueとLibraryのPlaylistは、別の入力から同じ再生セッションを作るものとして扱います。

```ts
type PlaybackSession = {
  id: string;
  entries: PlaybackEntry[];
  startIndex: number;
  origin: "catalog" | "workspace";
  policy: PlaybackPolicy;
};

type PlaybackEntry = {
  id: string;
  title: string;
  mediaRef:
    | { kind: "catalog"; workId: string; relativePath: string }
    | { kind: "workspace"; path: WorkspacePath };
  clip?: { startSec: number; endSec?: number };
  durationSec?: number;
};

type PlaybackPolicy =
  | { kind: "catalog-resumable"; workId: string; playlistId: string }
  | { kind: "ephemeral" };
```

Controllerは`PlaybackEntry`と状態遷移だけを扱います。`MediaResolver`が`mediaRef`をURLへ変換し、`PlaybackEventSink`がresume、lastPlayed、完聴を保存します。

LibraryのPlaylistからsessionを作る処理と、Filesの同一フォルダー音声からsessionを作る処理は各moduleに残します。共通化するのはsession以降のtransport、seek、loop、rate、MediaSessionです。現在Player内部へ分散しているwork/file分岐を、session構築とevent policyの境界へ集められます。[playerController.ts](../client/src/features/player/model/playerController.ts#L8)

### Work Managementを共有する

Libraryの作品詳細・編集はLibraryのquery hookやタグ遷移へ結合し、Filesは別の登録フォームとmutationを持っています。[WorkDetail.tsx](../client/src/features/library/ui/preview/WorkDetail.tsx#L13)、[RegisterWorkDialog.tsx](../client/src/features/files/ui/RegisterWorkDialog.tsx#L47)

次を`work-management`へ移します。

- `useWork(id)`
- sidecarのCAS編集
- Workspace folderの登録
- 登録解除
- DLsite previewと適用
- catalogとWorkspaceのcache invalidation方針
- 共有の`WorkInspector`と`WorkEditor`

Libraryにはタグクリックによる絞り込みや一覧選択を残します。Filesには物理path、ファイル内訳、sidecar health、登録・修復を残します。画面全体を共有せず、作品を管理する能力だけを共有します。

### Navigationの正本を一つにする

現在はLibraryとFilesの状態を複数のJotai atomへ置き、history要求を別atomへ書き、巨大なeffectがURLと相互同期します。[useNavigationHistory.ts](../client/src/features/navigation/model/useNavigationHistory.ts#L74)

次の判別unionをnavigation moduleの唯一の正本にします。

```ts
type AppRoute = LibraryRoute | WorkspaceRoute;

type WorkspaceRoute = {
  kind: "workspace";
  directory: WorkspacePath;
  selection?: WorkspacePath;
};
```

`navigate(route, { replace })`だけがURLとstateを更新し、`popstate`も同じstoreへ入れます。Jotaiは表示密度、tile size、popoverなどURLに含めないUI stateに限定します。TanStack Queryはserver state、route storeはlocation、PlaybackServiceは再生状態を所有します。

## DLsite連携

DLsiteから作品情報を取得する機能は維持します。見直すのは機能そのものではなく、scanとの暗黙連鎖と、外部サービスの一時状態をsidecarへ書くことです。

推奨する境界はmetadata providerです。

```text
候補作品
  └─ providerが検索・取得
       └─ preview差分
            ├─ ユーザーが適用
            └─ 見送り・手動修正
```

providerは`search`、`fetchPreview`、`applySelection`程度の能力に限定します。取得したHTML、HTTP状態、retry、selector version、lastAttemptAtはprovider cacheへ置きます。sidecarへ保存するのは、ユーザーが承認したRJ/VJ ID、title、circle、tags、URL、cover参照などです。

一括処理は残せます。対象件数と変更内容のsummaryを表示し、「新規作品だけ」「未設定項目だけ」「選択フィールドだけ」といった適用policyをユーザーが明示します。scan完了から無条件には開始しません。

scanとDLsite bulkの進捗管理は共通のtask modelへ寄せます。localhost単一利用の段階では、task IDを返してsnapshotをpollingする程度で足ります。現行scanのSSE履歴・reset・heartbeatと、DLsiteのsingleton progressという二系統は統一できます。[scanJobManager.ts](../server/src/scanJobManager.ts#L36)、[dlsiteJobManager.ts](../server/src/dlsiteJobManager.ts#L29)

## スマホUIと別端末接続

スマホ向けUIと、スマホからPCへ接続する仕組みは別の設計課題です。現在はMediaSessionとresume保存がすでに実装されていますが、MobileShell、PWA、LAN認証はまだ実装されていません。[useMediaSession.ts](../client/src/features/player/model/useMediaSession.ts#L33)、[index.ts](../server/src/index.ts#L136)

次の三段階に分けます。

### A. Responsive UI

現行のloopback構成を変更せず、狭いviewport向けのLibrary、Files、Playerを実装します。PWA、LAN接続、端末間同期は含めません。

MobileShellはpresentationの違いとして扱い、API権限を変えません。ただしclientのcompositionは整理し、共通部分にはPlayerRuntimeだけを置き、scanとDLsiteのruntimeは管理画面側へ寄せます。

この段階は認証方式を決めずに進められます。

### B. LAN上の単一所有者スマホ再生

本人のPCとスマホだけを対象にし、複数アカウント、共有、外出先アクセスを扱いません。

loopbackの管理面とLANの再生面を別route assemblyまたは別listenerにします。LAN側へ公開するのは次の範囲です。

- 作品と保存済み検索の読み取り
- coverと音声のRange配信
- resumeとlastPlayedの更新
- 必要なら列挙型のmarker操作

設定、root選択、物理Files、scan、登録・削除、汎用作品PATCH、DLsite、exportは公開しません。認証はユーザー管理を作らず、desktopでのpairingから単一device sessionを発行する程度に限定できます。

PCとスマホで同時再生した場合は、当面「同時再生を保証せず、resumeはserver到着順のlast-write-wins」と仕様化できます。device identity、CAS、leaseは追加しません。

### C. 広いremote

LAN外、複数利用者、共有、同時端末を扱う段階です。現時点では実装しません。必要になった時点で別gatewayまたは別product modeとして設計し直します。

この段階ではuser identity、ACL、`user_id + work_id`単位の状態、resume競合規則、TLS、media URL、帯域制御などが必要です。Bのlistenerを無条件に拡張しません。

近いうちの実装はAだけで構いません。実機スマホからの再生まで必要になった時点でBを選びます。ADR-0006はA、B、PWAを一つの決定に含めているため、分割して書き直す必要があります。

## 残す仕様と見直す仕様

| 項目                      | 判断             | 見直す内容                                                                               |
| ------------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| 物理ファイル・sidecar正本 | 維持             | 一方向投影、CAS編集、identity conflictを追加                                             |
| Files                     | 維持             | Workspace module化、管理状態とviewerを強化                                               |
| Library                   | 維持             | Catalog moduleとしてWorkspaceと分離                                                      |
| 複数Playlist              | 維持             | IDをWork配下へ閉じ、再生sessionへ変換                                                    |
| DLsite取得                | 維持・拡充       | scanから分離し、previewと明示適用を追加                                                  |
| scan自動登録              | 廃止決定         | 候補提示と一括承認へ置換（TASK-318、TASK-319）                                           |
| scan後のDLsite自動取得    | 適用のみ承認制へ | 取得は自動・cacheへ。適用はpreview明示承認（TASK-320）                                   |
| スマートフォルダーDSL     | 維持             | 縮小提案は撤回。requirements-v4 §7.5の正式機能であり、DRAFT-37は条件フィールド拡充の方向 |
| スマホUI                  | 近く実装         | Responsive UIとしてremoteから分離                                                        |
| LANスマホ再生             | 判断保留         | 単一所有者の限定再生面として設計可能                                                     |
| 広いremote                | 現時点では非目標 | 必要時に別gatewayとして再設計                                                            |
| DataAdapter               | 別途調査         | real/fixtureのユースケース二重実装を中心に確認                                           |

## 現行設計で維持したい改善

過去レビュー後に次の点は改善されています。古いDraftをそのまま実行し直す必要はありません。

- 通常検索、ページング、facetのSQL化
- PlayerControllerの状態機械
- Work、Playlist、Trackの安定ID
- resumeの`playlistId / trackId / offsetSec`化
- 構造化ログとrequest ID
- クライアントのfeature sibling境界検査
- エラーと空状態の分離
- ホーム、未再生、missing専用軸の整理

DRAFT-25、26、27、28、29、33は、実装前の問題設定が多く残っています。閉じるか、残件だけへ全面改稿する方が安全です。`requirements-v4.md`にも全件JS検索、旧3ペイン、旧ドリル、旧エラー軸が残っているため、次の実装計画を作る前に現在の仕様へ書き換えます。[requirements-v4.md](requirements-v4.md#L190)

## 実施順

1. user DBの自動再作成を禁止し、migrationとbackupを一本化する
2. sidecar正本、一方向投影、CAS編集、移動・複製時の挙動をADRとして確定する
3. scanをstaging、review、publishへ分割し、自動登録・自動DLsite取得を外す
4. root相対`WorkspacePath`と汎用Workspace media APIを定義する
5. typed route storeとPlaybackSessionを導入し、Files起因の分岐をplayer外へ出す
6. Work ManagementをLibraryとFilesから抽出する
7. clientをWorkspace、Catalog、Work Management、Playbackの縦moduleへ段階移行する
8. DLsite providerのpreview、明示適用、一括適用policyを整備する
9. Responsive UIを実装する。LAN接続とPWAは別判断にする
10. requirementsと解消済みDraftを現在の状態へ更新する

DataAdapterの再設計は別途調査対象とします。ただし、上記のWork Managementとsidecar投影を先に決めると、adapterへ残すI/O能力と共通use caseの境界を判断しやすくなります。

## 未決事項

2026-08-12に次を決定しました。

- catalog/userの物理2DBは維持する。ADR-0008の単一DB案却下理由（migration失敗がuserデータへ到達しうる）は現在も有効
- sidecar重複の自動修復（自動ID再採番）は廃止し、`identity_conflict`診断と明示操作による再採番へ置き換える（TASK-313、TASK-317）
- scan自動登録は候補提示＋一括承認へ全面置換する。既存の登録済みライブラリへは新ルールを再適用しない（TASK-318、TASK-319。TASK-166の要件確定）
- DLsite取得は自動のまま、sidecarへの適用はpreview差分の明示承認にする。既定policyは未設定フィールドのみ適用、上書きはフィールド単位で選択（TASK-320）
- scanの確認UIは候補・問題（identity_conflict、不正sidecar）があるときだけ表示する
- Filesの内蔵viewerは画像・PDF・text・videoまで対象にする（TASK-315、TASK-316）
- 未登録音声の再生履歴・resumeは保存しない

次の点は、実装前に利用方針を確認する必要があります。

- 近い将来の「スマホ対応」がResponsive UIまでか、実機からのLAN再生までを含むか
