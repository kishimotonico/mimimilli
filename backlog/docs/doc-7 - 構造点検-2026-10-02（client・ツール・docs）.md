---
id: doc-7
title: 構造点検-2026-10-02（client・ツール・docs）
type: other
created_date: '2026-10-02 11:45'
updated_date: '2026-10-02 11:45'
---
# 構造点検 2026-10-02（client・ツール・docs）

対象コミット 1c9f033c。8観点で探索し、観点ごとに実コードとbacklogで反証・重複確認した結果（もう一方の観点は doc-6 / doc-7 を参照）。行番号は点検時点のもので、後続のバグ修正で変わり得る。severity は検証後の値で、drop は対応不要と判断したもの。

## cli-arch-1 scan/DLsite一括取得のジョブ追跡がReactのeffect＋ref＋atomに手書きされ、操作は「Runtimeのマウント」を暗黙契約にしたatom経由の関数レジストリで公開される

- 判定: confirmed / new / severity medium
- 場所: client/src/features/scan/model/useScanJob.ts:37, client/src/features/scan/ui/ScanRuntime.tsx:88, client/src/entities/scan/useScanActions.ts:6, client/src/entities/scan/model/atoms.ts:38, client/src/features/dlsite/ui/DlsiteBulkRuntime.tsx:31, client/src/entities/dlsite/model/bulkAtoms.ts:44, client/src/features/player/model/PlayerRuntimeProvider.tsx:37

根拠（探索）: useScanJobは約280行にuseState、6本のref（sourceRef/attachedJobIdRef/snapshotRef/generationRef/terminalHandled等）、世代カウンタ、状態ランク比較を持つSSE状態機械で、結果をScanRuntimeのuseEffectでscanJobAtomへ複写している（job状態がhook state→atomの二重管理）。DlsiteBulkRuntimeも別実装で、jobId・starting・cancelling・progressを個別atomに分け、約100行のuseEffect内でSSE購読・confirm・applySnapshot・detach・世代管理を行う。両者のstart/cancel/attach/resetは scanActionsAtom / dlsiteBulkActionsAtom に「マウント時にsetActions、アンマウントでnull」で登録され、利用側(entities/scan/useScanActions.ts, entities/dlsite/useDlsiteBulkActions.ts)は未マウントならthrowする。Player側にも同型のregisterCapabilities/requireCapabilities（NOT_REGISTERED_ERROR）がある。さらに scan→dlsite の連携（ScanRuntimeがdlsiteBulk.attach()を呼ぶ）や root再設定突入時のscanActions.reset()は、このatom経由レジストリを通る。entities層がfeatures層のコンポーネントのマウント有無に実行時依存している。

裏取り（検証）: 事実はほぼ正確。useScanJob.ts は283行で useRef 8本（sourceRef/attachedJobIdRef/snapshotRef/generationRef/terminalHandled に onTerminalRef/onStartRef を加えた数）。ScanRuntime が useEffect で scanJob.job を scanJobAtom へ複写している（hook state→atom）。DlsiteBulkRuntime は282行で jobId/starting/cancelling/progress を個別atomに分け、SSE購読を useEffect 内で持つ。scanActionsAtom/dlsiteBulkActionsAtom は「マウント時 setActions、アンマウントで null」で登録され、useScanActions.ts と useDlsiteBulkActions.ts は未マウントなら throw する。ScanRuntime から dlsiteBulk.attach() を呼ぶ連携と App の scanActions.reset() もこの経路を通る。PlayerRuntimeProvider にも registerCapabilities/requireCapabilities/NOT_REGISTERED_ERROR がある。Runtime は Providers.tsx で常時マウントされるため、現状で throw が起きるのは配置を変えた場合のみ。「featuresのRuntimeが居る前提」が entities に埋まっている点は実在する。

既知との関係: TASK-470.1/470.2/470（Done）はサーバーSSE契約を現在状態同期にしただけで、client の状態機械の所在とactionsレジストリは未対応。TASK-428.4・TASK-447.20（Done）は完了通知とトーストの整理。TASK-387・TASK-411（Done）は隣接するが別論点。ADR-0030 は進捗＝現在状態の契約のみ。「Runtime/actionsレジストリ廃止」を扱う既存タスクやドラフトは見つからなかった。

評価: 指摘自体は妥当。ジョブ状態機械がReactのrender/effect順序に依存し、scan と DLsite が別実装のまま、entities が features のマウント有無に実行時依存している。方向性（React外のジョブストアとして entities に置き、start/cancel を直接メソッド化してレジストリを廃止）も長期的に正しい。ただし実害は現状ほぼなく、設計上の負債にとどまる。proposal の「Playerのcapabilities整理」や「共通SSE job tracker」まで同時にやると過剰になりうる。scan と DLsite をまず1つの純TSストアに揃え、Player は別判断にするのがよい。severity は high でなく medium。

探索時の提案: ジョブ追跡をReact外のサービス（createStoreに載るJob store: snapshot・SSE接続・世代管理・終端ハンドラを1箇所に持つ純TS）として entities/<job>/ に置き、Jotai atom（または外部store）の購読だけでUIに公開する。start/cancel/attach/resetはこのサービスの直接メソッドにして、atomレジストリとrequireActionsを廃止する。Runtimeコンポーネントはトースト・キャッシュ更新などの終端時の副作用の配線だけにするか、終端コールバックをapp層で登録する形にする。scanとDLsiteで共通のSSE job tracker（現在状態同期、ADR-0030）を共有し、Playerのcapabilities登録も同じ方針で整理する。

## cli-arch-2 root再設定の遷移処理がApp.tsx・3つのEffectコンポーネント・epoch atom・error handlerに分散し、Jotai read API禁止ルールのために構造が歪められている

- 判定: partial / new / severity medium
- 場所: client/src/app/App.tsx:92, client/src/app/App.tsx:102, client/src/app/App.tsx:128, client/src/app/ReconfigurationEntryEffect.tsx, client/src/app/ReconfigurationExitEffect.tsx:20, client/src/app/RootReconfigurationDriftEffect.tsx:20, client/src/app/model/useRootReconfiguringApiErrorHandler.ts:20, client/src/app/model/resetLibraryForReconfiguration.ts:19, client/src/entities/settings/reconfigurationExitAtom.ts

根拠（探索）: 再設定の突入側は App.tsx の performReconfigurationEntryReset（再生停止・guard無効化・モーダル閉・DLsite適用ダイアログ閉・scan reset・route初期化・hiddenPaths破棄・epoch++・stale化の9操作を依存配列9個のuseCallbackで束ねる）と startupState 変化を見るuseEffect+wasReconfiguringRef。離脱側は ReconfigurationExitEffect（epoch atom購読→resetQueries→fetchQuery→dlsiteBulk.attach）、別タブ完了検知は RootReconfigurationDriftEffect（rootFolder/completedAt比較）、409検知は useRootReconfiguringApiErrorHandler。ExitEffectの冒頭コメントは『App.tsxはJotaiのread APIをimportしない方針のため、この専用コンポーネントに分離』と明言しており、lintルールが設計を決めている。破棄対象クエリキー一覧は resetLibraryForReconfiguration.ts のリスト＋生の["scan"]で別途保持され、workCacheUpdates.tsのキー群と独立に保守される。App.tsx自体も40超のimport・8個のuseSetAtomを持つ。さらに ScanRuntime/DlsiteBulkRuntime は Providers で再設定中も常時マウントされるため、各所に isRootReconfiguringError の特例分岐（全16参照）が散る。

裏取り（検証）: 構造の記述は概ね正確。App.tsx の performReconfigurationEntryReset は停止（player.stop＋guard無効化）、モーダル閉、DLsite適用ダイアログ閉、scanActions.reset、navigate、hiddenPaths破棄、epoch++、stale化で実質9操作を束ねる。useCallback の依存配列は8個で、「9個」は誤り。ReconfigurationExitEffect、RootReconfigurationDriftEffect、ReconfigurationEntryEffect の3つのEffectコンポーネントが存在する。ExitEffect 冒頭に「App.tsxはJotaiのread APIをimportしない方針のため、この専用コンポーネントに分離」とあり、.oxlintrc.json の App.tsx 向け no-restricted-imports（useAtom/useAtomValue 禁止）が根拠。resetLibraryForReconfiguration.ts のキー一覧と生の ["scan"] は独立して保守されている。App.tsx は import 45行、useSetAtom 8個。isRootReconfiguringError の参照は16件で正確。Scan/DlsiteBulk Runtime は Providers で常時マウントされる。

既知との関係: TASK-469.2（Done）が現行の client 実装の起点で、ADR-0029 が状態遷移とロックの仕様。いずれも client 内の遷移処理の集約は対象にしていない。TASK-466（Done）は AppRoute 一本化、TASK-448.2（Done）は LibraryView 分割で、いずれも隣接するだけ。再設定オーケストレーションの集約を扱う既存タスクは見つからなかった。

評価: 指摘は実在する。突入側と離脱側の分散、リセット対象を各所が個別に知ること、lint が構造を決めていることは確認できた。純TSの controller に集約し、リセットを1リストにまとめる方向は妥当。「Jotai read API禁止ルールを緩める」は、そのルール自体の再評価として検討に値する。一方「Runtime を ready 時のみマウントにして409特例を撤去」は、初回セットアップ後の attach や scan 状態の追従との整合を取る必要がある。1タスクで全部やる提案としては大きいので、controller 集約と Runtime マウント条件は分けるべき。動作する仕様化済みの機構なので severity は medium。

探索時の提案: 再設定を『ReconfigurationController』として単一の純TSモジュール（app/model）に集約する: 状態導出（startup state）・突入リセット・離脱リセットをstoreのアクションとして定義し、リセット対象（再生停止、モーダル、route、scan/dlsite、キャッシュ）は各ドメインが登録する reset フックまたは明示的な1リストに集約する。App.tsxは起動画面の分岐と合成だけにし、『Jotai read API禁止』ルールは設計を歪めるなら緩める（oxlint側を見直す）。常時マウントRuntimeはready時のみマウントに変えて409特例を撤去する（Providers直下からapp配下のready分岐へ移す）。

## cli-arch-3 クエリ定義（key+queryFn+enabled）が各所にインライン重複し、queryOptions化されているのは3件だけ。TASK-188型の衝突リスクを構造的に残している

- 判定: confirmed / extends-known / severity low
- 場所: client/src/features/library/model/useLibraryQueries.ts:186, client/src/features/library/model/useLibraryQueries.ts:190, client/src/features/library/ui/WorkDetailPage.tsx:52, client/src/features/library/ui/WorkDetailPage.tsx:56, client/src/features/library/ui/WorkDetailBreadcrumbs.tsx:15, client/src/features/files/model/useSingleFileWorkTitle.ts:10, client/src/features/files/ui/RegisterWorkDialog.tsx:56, client/src/features/scan/ui/ScanModal.tsx:76, client/src/features/scan/ui/ScanModal.tsx:91, client/src/app/ui/NotificationBell.tsx:36, client/src/features/scan/model/useScanCandidatesCache.ts:20, client/src/features/files/model/useIdentityConflict.ts:13, client/src/app/ReconfigurationExitEffect.tsx:29

根拠（探索）: WORK_QUERY_KEYS.detail(workId ?? "") + getWork(workId!) + enabled は useLibraryQueries / WorkDetailPage / WorkDetailBreadcrumbs / useSingleFileWorkTitle の4箇所で手書き（非nullアサーション付き）。TAG_QUERY_KEYS.all()+getAllTags は3箇所、SCAN_QUERY_KEYS.last()+getLastScanResult は4箇所（NotificationBell, ScanModal, useScanCandidatesCache, ReconfigurationExitEffectのfetchQuery）、SCAN_QUERY_KEYS.diagnostics() は3箇所。useLibraryQueries.ts冒頭のコメントはTASK-188（同一keyで異なるqueryFnがcacheを占有してクラッシュ）を理由にqueryOptionsを共有する、と説明しているが、その方針が適用されたのは libraryTotal/errorViewCount/missingWorksCount の3つのみ。

裏取り（検証）: 数はほぼ正確。getWork の queryFn 手書きは useLibraryQueries.ts:187、WorkDetailPage.tsx:53、WorkDetailBreadcrumbs.tsx:16、useSingleFileWorkTitle.ts:11 の4箇所で、いずれも非nullアサーション付き。getAllTags は useLibraryQueries、RegisterWorkDialog、WorkDetailPage の3箇所。getLastScanResult は NotificationBell、ScanModal、useScanCandidatesCache、ReconfigurationExitEffect（fetchQuery）の4箇所。SCAN diagnostics を useQuery で使うのは NotificationBell、ScanModal、useIdentityConflict の3箇所。queryOptions 化済みは libraryTotal/errorViewCount/missingWorksCount の3件のみで、useLibraryQueries.ts のコメントが TASK-188 の衝突を理由に挙げている。ただし現状どのkeyも同じ queryFn で、衝突は未発生。

既知との関係: TASK-411（Done）は queryKey のリテラル直書きを ファクトリへ集約済みで、queryFn と key の組を共有する queryOptions 化は範囲外。queryOptions を扱う既存タスクは見つからなかった。

評価: queryOptions ファクトリを entities に置く提案は TanStack Query の定石で、非nullアサーションやダミー key を消せるため、やる価値はある。ただし現状は全箇所が同一 queryFn で実害はなく、型で防ぐ設計改善の位置づけ。「直書きを lint で禁止」まで入れるのは過剰気味で、ファクトリ化だけで十分。severity は medium でなく low。

探索時の提案: entities/<x>/queries.ts に queryOptions ファクトリ（workDetailQueryOptions(id)、tagsQueryOptions、scanLastQueryOptions、scanDiagnosticsQueryOptions 等）を置き、feature・app・Effectは必ずそれ経由で useQuery/fetchQuery/ensureQueryData する。直書きの queryKey: + queryFn: をlint（no-restricted-syntaxまたはカスタム検査）で禁止し、queryKeys.ts はqueryOptions内部とキャッシュ更新ファイルだけが使う。

## cli-arch-4 作品キャッシュ更新はADR-0028でentities/work/modelに集約された建前だが、featuresに直接のinvalidate/resetが残り、更新責務が3か所に分裂している

- 判定: partial / extends-known / severity low
- 場所: client/src/entities/work/model/workCacheUpdates.ts:11, client/src/features/library/model/workPatchInvalidation.ts:22, client/src/features/library/model/workPatchListCache.ts:16, client/src/features/library/model/smartFolderInvalidation.ts:15, client/src/features/files/ui/FilePreviewWorkActions.tsx:116, client/src/features/settings/ui/TagPrefixSettings.tsx:52, client/src/features/scan/ui/ScanRuntime.tsx:54, client/src/features/scan/ui/scanModal/UnregisteredTab.tsx:105, client/src/features/player/model/usePlayer.ts, client/src/features/library/ui/preview/WorkEditDialog.tsx

根拠（探索）: docs/ARCHITECTURE.mdは『成功後の必須キャッシュ更新はentities/work/model/workMutations.ts / workCacheUpdates.tsが持つ』と規定。実際には workCacheUpdates.ts が invalidateRegistrationViews 等を持つ一方で、(a)ブックマーク時に表示中リストをパッチ/resetする apply を library が組み立てて渡す（workPatchInvalidation.ts / workPatchListCache.ts、InfiniteData内部構造に依存）、(b)スマートフォルダー保存の無効化は library/model/smartFolderInvalidation.ts、(c) FilePreviewWorkActions.tsx:116-123 は FILE_SYSTEM と SCAN.diagnostics を feature 内で直接 invalidate（workCacheUpdates の invalidateRegistrationViews と同じ集合の手書き複製）、(d) ScanRuntime がscan完了時に setQueryData(SCAN_QUERY_KEYS.last())・SETTINGS を直接触る、(e) TagPrefixSettings が TAG_QUERY_KEYS.prefixes を feature 内で invalidate。更新の入口が workMutations / workCacheUpdates / 各featureのモデルの3系統になっている。

裏取り（検証）: 前提の一部が誤り。ADR-0028 は「表示中の一覧のパッチ/reset は表示最適化として Library に残す」と明記しており（集約範囲外、79行目の「パッチと reset のどちらを選ぶかは軸を知る画面が決める」）、(a) の workPatchInvalidation.ts / workPatchListCache.ts は設計どおり。「ADR-0028の建前が不徹底」とは言えない。(b) smartFolderInvalidation.ts と (e) TagPrefixSettings のタグprefix無効化は、作品変更mutationではなくスマートフォルダー/タグprefix領域で、ADR-0028 の対象外。(d) ScanRuntime がスキャン完了で setQueryData と SETTINGS 無効化を直接行うのは事実だが、scan完了は updateCachesAfterLibraryScan 経由で作品側を更新済み。実在する指摘は (c) のみ。FilePreviewWorkActions.tsx:121-124 の alreadyRegistered 分岐が FILE_SYSTEM と scan diagnostics を直接 invalidate している。ただし workCacheUpdates の invalidateRegistrationViews は非exportで、手書き複製は2キーだけ。この分岐は mutation ではない。「3系統に分裂」「featuresのqueryClient直接操作（TagPrefix/ExcludedFolders含む）の検査追加」は過大。

既知との関係: ADR-0028 と TASK-465（Done）が正本で、集約範囲外を意図して明記している。TASK-411（Done）が ScanRuntime/UnregisteredTab 周辺の best-effort を整理済み。TASK-448群は LibraryView 分割で別論点。

評価: 実質は FilePreviewWorkActions の alreadyRegistered 分岐が登録後更新の集合（作品系ビューを含む）を手書きで一部しか持たないことくらい。直すなら該当分岐を workCacheUpdates の関数経由にする小さな修正で足りる。「全mutationをentitiesのhookへ」「features内のqueryClient操作を機械検査で禁止」はADR-0028の意図的な線引きを崩す過剰設計なので採らない。

探索時の提案: 全ての『サーバー状態を変える操作』を entities/<domain>/model/*Mutations.ts のhookに寄せ、更新集合は1ファイル内の名前付き関数で決める。ブックマークの表示中リスト追従は『一覧の所属が変わる軸ではreset、それ以外はキャッシュパッチ』を entities 側の関数（作品リストキャッシュの操作＝InfiniteData知識はentitiesに閉じる）として提供し、featureは軸の種類だけを渡す。FilePreviewWorkActions・TagPrefixSettings等のfeatures内のqueryClient直接操作を禁止する検査を足す。

## cli-arch-5 再生開始の準備オーケストレーションがapp/App.tsxに置かれ、handlePlay/handleResumeの重複と onPlay 系propsの深いドリルダウンを生んでいる

- 判定: confirmed / new / severity medium
- 場所: client/src/app/App.tsx:161, client/src/app/App.tsx:187, client/src/app/AppBody.tsx:14, client/src/features/library/ui/LibraryView.tsx, client/src/features/library/ui/WorkDetailPage.tsx:40, client/src/features/library/ui/PreviewPane.tsx, client/src/features/library/ui/preview/WorkDetail.tsx, client/src/features/library/ui/preview/WorkPlayButton.tsx

根拠（探索）: handlePlay と handleResume は prepareWorkPlayback → updateCachesAfterPlaybackPrepared → playRequestGuardによる二重の鮮度確認 → エラートースト(isRootReconfiguringError除外) までがほぼコピーで、末尾だけ player.play / player.playWithResume が違う。playRequestGuardはApp内のuseRefで保持され、root再設定突入時にApp内のstopPlaybackAndInvalidateGuardで無効化される。この結果 onPlay/onResume/onTogglePlay が AppBody → LibraryView → LibraryResultsPane/PreviewPane → WorkDetail → WorkPlayButton のように10個前後のコンポーネントでpropsとして受け渡されている（onPlay|onResume|onTogglePlay は library/ui だけで10ファイル以上）。Filesは別系統の onPlayFile を受ける。

裏取り（検証）: 正確。App.tsx の handlePlay と handleResume は prepareWorkPlayback → updateCachesAfterPlaybackPrepared → playRequestGuard による鮮度確認2回 → エラートースト（isRootReconfiguringError除外）までがほぼコピーで、末尾だけ player.play と player.playWithResume が異なる。playRequestGuard は App 内の useRef で保持され、stopPlaybackAndInvalidateGuard が再設定突入時に無効化する。onPlay/onResume/onTogglePlay の伝搬は AppBody → LibraryView → LibraryResultsPane/PreviewPane → WorkDetail → WorkPlayButton などで、library/ui 内で12ファイル、library 以外にも files/player に及ぶ（「10ファイル以上」は妥当）。

既知との関係: TASK-448.1/448.2（Done）は props の並存と LibraryView の責務分割で、再生起動のオーケストレーションと再生コールバックの伝搬は未カバー。TASK-368（Done）はプレイヤー領域のリファクタだが再生準備の置き場は対象外。

評価: 妥当。再生開始の準備・鮮度確認・失敗UXは player の責務で、app にあるのは置き場違い。usePlayWork（または controller のコマンド）に一本化して guard も同居させ、各画面が直接呼ぶ形にすれば、handlePlay/handleResume の重複と props ドリルが同時に消える。再設定時は stop() を呼ぶだけで済む。過剰設計ではなく、cli-arch-2 の再設定集約とも噛み合う。

探索時の提案: 『作品IDまたはWorkを渡して準備→再生する』を entities/player もしくは features/player の usePlayWork() フック（または playerController のコマンド）に一本化し、request guardもそこが持つ。各画面は props ではなく直接そのフックを呼ぶ。App.tsxはreset時にplayerのstop()を呼ぶだけにする。TASK-448.1（WorkGrid/WorkListPaneのprops整理）とは別に、再生導線のpropsドリルを同時に解消する。

## cli-arch-6 best-effort握りつぶし(.catch(() => {}))がclient-error-handling.mdの許可一覧外で増えている

- 判定: partial / extends-known / severity low
- 場所: client/src/features/scan/ui/ScanRuntime.tsx:55, client/src/features/scan/ui/ScanModal.tsx:85, client/src/features/scan/ui/scanModal/UnregisteredTab.tsx:105, client/src/features/dlsite/ui/DlsiteBulkRuntime.tsx:129, client/src/features/dlsite/ui/DlsiteBulkRuntime.tsx:178, client/src/features/dlsite/ui/DlsiteBulkRuntime.tsx:103, client/src/app/ReconfigurationExitEffect.tsx:33, docs/client-error-handling.md, docs/adr/0015-client-error-contracts.md

根拠（探索）: client-error-handling.mdが列挙する『完全に無視する箇所』はresume保存・updateLastPlayed・AudioContext.resume/close・SSE切断後getScanJobの5件のみで、基準は『失敗しても再生・表示が継続し自動回復または破棄時のクリーンアップ』。実コードには refreshScanCandidates（候補プール再取得）、updateCachesAfterDlsiteBulkFetch（DLsite完了後のキャッシュ無効化）、ReconfigurationExitEffectのlast scan取得、DlsiteBulkRuntime.attach内の getDlsiteBulkStatus の bare catch がユーザー通知なしで握りつぶされており、一覧にない。これらは失敗するとスキャン直後の未登録候補やDLsite適用後の表示が古いまま残り、自動回復の保証がない。ADR-0015は『エラー表示経路をatom→toastに一本化』『新規の握りつぶしを安易に追加しにくくする』を帰結にしているが、その規約を機械的に守る仕組み（lint・共通ヘルパー）はない。ADR-0015の本文は廃止済みのscanErrorAtom/dlsiteBulkErrorAtomを現行として記述しており、docs側も食い違う。

裏取り（検証）: 箇所は概ね実在する。ScanRuntime.tsx:55、ScanModal.tsx:85、UnregisteredTab.tsx:105 の refreshScanCandidates(...).catch(() => {})、DlsiteBulkRuntime.tsx:129 と :178 の updateCachesAfterDlsiteBulkFetch(...).catch(() => {})、:119 の getDlsiteBulkStatus 用 bare catch、ReconfigurationExitEffect.tsx:33 の握りつぶしを確認した。docs/client-error-handling.md の「完全に無視する箇所」は5件で、これらは一覧外。ただし DlsiteBulkRuntime:103 は握りつぶしではなく isRootReconfiguringError の分岐。updateCachesAfterDlsiteBulkFetch は invalidateQueries の Promise.all で、invalidateQueries は既定で reject しないため、その .catch は事実上不要。ADR-0015 本文は廃止済みの scanErrorAtom/dlsiteBulkErrorAtom を現行として記述しており、docs と食い違う点も実在する（ADRは決定記録なので、書き換え要否は別判断）。

既知との関係: TASK-411（Done）の AC#1 が「best-effortならcatchして握る」と明示しており、これらの握りつぶしはその決定の帰結。docs 一覧への未反映と機械化だけが範囲外。

評価: 最も価値があるのは、実質デッドな .catch の整理（invalidateQueries 系は catch 不要にする）と、refreshScanCandidates の再取得を握りつぶさず次の通常取得に任せる方針の明文化。docs 一覧と実装の不一致の解消も妥当。`ignoreBestEffort` ヘルパーや lint による機械検証は、数件のための抽象化で過剰。キャッシュ再取得失敗が実害（古い一覧）を生む可能性は低く、severity は medium でなく low。

探索時の提案: cache refresh系は『失敗時はstaleのまま残し、次の通常クエリ再取得に任せる』と明文化するなら invalidateQueries（reject しない）に寄せて.catchを不要にする。それ以外は握りつぶしでなくtoast/ローカルUIへ。許可する握りつぶしは `ignoreBestEffort(promise, reason)` のような名前付きヘルパーに一本化して grep・lintで一覧と突き合わせ可能にし、docsの一覧を機械検証できる形にする。ADR-0015の現在形記述はcurrent-state側(docs)に合わせて更新する。

## cli-arch-7 shared/model/activeModalAtom が feature 固有のドメイン（DLsite通知モーダル種別・スキャンタブ）を知り、全モーダルが単一atom＋AppModalsのprops中継になっている

- 判定: confirmed / extends-known / severity low
- 場所: client/src/shared/model/activeModalAtom.ts:1, client/src/app/ui/AppModals.tsx:19, client/src/app/App.tsx:210, client/src/entities/scan/model/atoms.ts:7, client/src/features/scan/ui/scanModal/types.ts

根拠（探索）: shared層に DLSITE_NOTIFICATION_MODAL_KINDS / ScanExternalTab / settings・scan・dlsite通知の判別共用体が定義されており、sharedがfeaturesの概念を内包している（コメントでfeatures/scan側の型が別途持つと明記）。entities/scan/model/atoms.ts の scanModalOpenAtom も shared の activeModalAtom の kind==='scan' に依存する。モーダルを開く判断はApp→AppModalsのpropsで onChangeFolder / onExport / onOpenFiles / onOpenWork / lastScanTime を中継して各モーダルへ渡す構成で、SettingsModalのonChangeFolderはApp.tsxのstartReconfigurationにつながる。

裏取り（検証）: 事実は正確。shared/model/activeModalAtom.ts に DLSITE_NOTIFICATION_MODAL_KINDS、ScanExternalTab、settings/scan/DLsite通知の判別共用体が定義されている。entities/scan/model/atoms.ts の scanModalOpenAtom はこの atom の kind==='scan' に依存する。AppModals は lastScanTime/onChangeFolder/onExport/onOpenFiles/onOpenWork を props で中継する。TASK-447.23 で意図的にこの構成にした経緯がある。

既知との関係: TASK-382（Done）は DLsite通知系モーダルの配置を features/dlsite へ移しただけ。TASK-447.23（Done）が activeModalAtom と AppModals を導入した。共有atomへの feature 語彙の混入は未カバー。

評価: レイヤー的な違和感は実在するが、アプリ唯一のモーダルを1つの判別共用体で管理する現構成は単純で、実害は小さい。モーダルを足すたびに3箇所を触る程度。汎用モーダルホストをジェネリック化して app 層で合成する案は、将来構想のための一般化に傾く。語彙の置き場（kind定義を app へ移す程度）で十分で、優先度は低い。

探索時の提案: shared には汎用の『モーダルスタック／単一モーダルホスト』（kindは文字列ジェネリック）だけ置き、具体的な ActiveModal 型は app 層で feature のモーダル定義を合成して導出する。モーダルが必要な依存（rootFolder、reconfigurationの開始、export）はAppModalsのprops中継でなく、各モーダルがentities/appのフックから直接取得する。

## cli-arch-8 ライブラリのナビゲーション購読が atom → hook → Context の三重構造で、transition用Contextと状態Contextが分離している

- 判定: partial / duplicate / severity drop
- 場所: client/src/entities/library/model/navigationAtoms.ts:1, client/src/entities/library/model/navigationActions.ts:15, client/src/features/library/model/useLibraryNavigation.ts:48, client/src/features/library/ui/LibraryNavigationProvider.tsx:6, client/src/features/library/model/libraryNavigationContext.ts, client/src/features/library/model/libraryTransitionContext.ts, client/src/app/App.tsx:285

根拠（探索）: AppRouteを正本とするatom（selectedTags/activeAxis/sort...）と、action atom群（setLibraryAxisAtom等10個）がentitiesにあり、featureのuseLibraryViewがこれらをuseAtomValue/useSetAtomで束ねて useTransition でラップし、LibraryNavigationProviderがそれを2つのContext(LibraryNavigationContext, LibraryTransitionContext)に流し、消費側がuseLibraryNavigation/useLibraryTransitionでContextから読む。状態はすでにグローバルstoreにあるのにContextで再配布しており、Providerを外すと『LibraryNavigationProviderが必要です』でthrowする。Providerは App.tsx の ready 枝に置かれ、AddressBar等のapp/ui配下の消費者もこれに依存する。

裏取り（検証）: 構造の記述は正確。navigation atom と action atom 群（entities）を useLibraryView が束ねて useTransition でラップし、LibraryNavigationProvider が LibraryNavigationContext と LibraryTransitionContext の2つで配布する。Provider なしで throw し、App.tsx:284 の ready 枝で配置される。ただしこの構成は TASK-381 の結果としての意図的な設計。Provider が単一の useTransition を持つことで、全操作が nav.isPending（WorkListPane の is-pending 暗転）に反映される。TASK-381 の Final Summary に、個別 atom 購読にしたら isPending に反映されない副作用が出たため Transition Context を別途設けたと明記されている。「状態はすでにグローバルstoreにあるのにContextで再配布」は、transition 共有の目的を無視した見方。「4つの読み取り経路が併存」も、useLibraryNavigation の消費者が5ファイル程度で誇張気味。

既知との関係: TASK-381（Done）が購読経路の統一とTransition Contextの導入を担当。TASK-466（Done）は AppRoute 一本化。多段構造はその帰結で、既知の範囲内。

評価: transition を atom またはシングルトン関数へ持つ案は、React の useTransition がコンポーネント内でしか使えない以上、実現が不自然（startTransition のモジュール関数では isPending を取れない）。現行は共有 transition の必然的な形で、Contextを廃止する利点は薄い。drop。

探索時の提案: transition（isPending）を扱うのはアクション呼び出しのラップだけなので、useTransitionの結果をContextではなくatomまたはシングルトン関数へ持ち、ナビゲーション状態の購読はatomのみに一本化する。『ナビ操作をtransitionで包むフック』を1つ用意しContextを廃止する。

## cli-ui-1 ダイアログの外枠・ヘッダー・フッターが共通化されておらず12箇所でクラス文字列を複製している

- 判定: partial / new / severity medium
- 場所: client/src/shared/ui/ConfirmDialog.tsx:29, client/src/features/library/ui/preview/WorkEditDialog.tsx:108, client/src/features/library/ui/preview/WorkEditDialog.tsx:389, client/src/features/scan/ui/ScanModal.tsx:142, client/src/features/settings/ui/SettingsModal.tsx:99, client/src/features/dlsite/ui/NotificationListModal.tsx:42, client/src/features/dlsite/ui/DlsiteBulkApplyDialog.tsx:33, client/src/features/files/ui/RegisterWorkDialog.tsx:155, client/src/features/library/ui/SmartFolderEditorModal.tsx:151, client/src/features/library/ui/preview/WorkInfoDialog.tsx:56, client/src/features/library/ui/preview/DlsiteEditor.tsx:132

根拠（探索）: shared/ui には useDialogModal(フック)と ConfirmDialog(確認専用)しかなく、モーダル殻のコンポーネントが無い。rg で `rounded-[12px] border border-line-soft bg-paper-1 ... shadow-pop backdrop:bg-[oklch(20%_0.020_70_/_0.3)]` が11ファイル・12箇所に完全一致で存在し、`<dialog ref onCancel onClick={handleBackdropClick}>` + oxlint-disable コメント + `header(px-[18px] py-[14px] border-b) / footer(border-t px-[18px] py-3)` も各所で手書き。ヘッダー padding は py-3 と py-[14px] が混在し、最大高も calc(100vh-32px)/calc(100vh-48px)/min(80vh,...) と揺れている。WorkEditDialog の UnsavedChangesPrompt は ConfirmDialog の 360px 殻を丸ごと複製した3択版で、DlsiteEditor の DlsiteApplyDialog も createPortal+同じ殻を手書きしている。backdrop の oklch 直書きは tsx に12箇所。

裏取り（検証）: 殻のクラス列(m-auto ... overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 shadow-pop backdrop:...)の複製は事実。ただし数が誇張で、実際は10ファイル・11箇所(ConfirmDialog, NotificationListModal, RegisterWorkDialog, ScanModal, DlsiteBulkApplyDialog, SettingsModal, SmartFolderEditorModal, WorkInfoDialog, DlsiteEditor, WorkEditDialog x2)。「11ファイル・12箇所」は過大。backdrop oklch直書きも同数の11箇所(tsx。Lightboxは別形)。ヘッダー padding は py-[14px] が大半で、py-3 は WorkEditDialog の1箇所のみ(混在は事実だが1件)。max-h もダイアログごとに値が異なる。shared/ui に Modal殻が無く useDialogModal と ConfirmDialog のみなのも事実。DlsiteEditor の DlsiteApplyDialog は createPortal(L130)+独自殻、WorkEditDialog の UnsavedChangesPrompt は 360px 殻の複製(L115)で事実。

既知との関係: ダイアログ殻の共通化に特化したタスク・ドラフト・ADRは無し。TASK-428.21(共通Button, Done)・TASK-447.24(TextInput共通化, Done)・TASK-447.23(モーダル開閉状態のatom化, Done)は近接するが殻は未対応。docs/design-system.md はダイアログの閉じ方を useDialogModal 経由と散文で規定している。

評価: 妥当。Button/TextInput を共通化してきた方針の延長として Modal(殻+Header/Footer)の抽出は筋が良く、実害(余白・max-h の揺れ、UnsavedChangesPrompt の殻複製)も実在する。ただし high は過大で medium。提案のうち「素の dialog を oxlint で禁止」と「ConfirmDialog を n択へ拡張」は実装時に必要なら足す程度に留め、まず Modal 殻+size variant に絞るのがよい。backdrop 色・角丸・影のトークン化は殻に吸収されるため別作業にしない。

探索時の提案: shared/ui に Modal(殻: size variant・Header/Body/Footer スロット・useDialogModal 内蔵・portal 要否・busy 時 close 抑止)を作り、ConfirmDialog は Modal の薄い特化として「n択アクション」を受けられる形へ拡張(UnsavedChangesPrompt を吸収)。backdrop 色・角丸・影はトークン化する。全モーダルを移行して素の `<dialog>` を oxlint の no-restricted-syntax で禁止する。

## cli-ui-2 CSSが『元shell.cssの記述順を保つため』の機械的分割(library-a〜e, frame-a〜c, shared-a〜d)で、責務境界にもTailwind二重体系の方針にもなっていない

- 判定: partial / extends-known / severity medium
- 場所: client/src/styles/shell/index.css:1, client/src/styles/shell/library-a.css:1, client/src/styles/shell/library-d.css:1, client/src/styles/shell/shared-d.css:1, client/src/styles/shell/frame-b.css:103, client/src/styles/shell/library-c.css:136

根拠（探索）: index.css 冒頭コメントが『元の shell.css の記述順と完全に一致するように並べてある』『同一レイヤー内はソース順で優劣が決まる』と明記し、library は library-a〜e の5ファイル、frame は a〜c、files は a〜c、shared は a〜d に『元ファイル内で区画が離れていたため』分割され、@import 順が library-a→frame-b→library-b→frame-c→library-c→files-a→library-d… と所有者が交互に並ぶ。つまり『ソース順に依存する詳細度同値の上書き』が分割の制約になっている。library-d.css は 888 行で軸レール/作品行/タグANDバンド/コラージュ/値一覧(行・タイル)/クイックオーバーレイ/ドリルヘッダーの7区画を持つ。prefers-reduced-motion の打ち消しが shared-d(全体)・frame-b:103・library-c:136 に分散。プレフィックスも mll-/mle- の2種が意味不明のまま混在(124クラス)。tsx 62ファイルが Tailwind、77ファイルが mle-/mll- を使い、同一コンポーネント内で両方を混在(例 FieldConflictNotice は mle-prv__edit-conflict、隣は Tailwind)。

裏取り（検証）: index.css 冒頭コメントが『元の shell.css の記述順と完全に一致』と書いており、library-a〜e(5)・frame-a〜c・files-a〜c・shared-a〜d の機械的分割、@import 順が library/frame/files で交互に並ぶのは事実。library-d は 888 行で、軸/行/タグバンド/コラージュ/値一覧/クイックオーバーレイ/ドリルヘッダーの区画を持つのも事実。prefers-reduced-motion は実際には shared-d(2)・library-c(1)・frame-b(1)に加え player-dock(5相当ではなく別の用途)等のファイルにも出現し、『3箇所に分散』は概ね事実。mle-/mll- は役割が docs/design-system.md L73-74 に定義済み(mle=共通シェル、mll=Library固有)で、「意味不明のまま混在」は誤り。「124クラス」の数値は裏が取れず(出現は mle-434/mll-272 回)。「tsx 62が Tailwind、77が mle-/mll-」も裏が取れない(77は mle-/mll- を含むtsx数としては合う)。Tailwind とのレイヤー関係(components < utilities)は design-system.md L77 に明記されており『基準が無い』も言い過ぎ。TASK-368 で player-a.css は所有者単位の4ファイルに分割済みなので、今後の整理先の見本が既にある。

既知との関係: CSS構成そのもの(分割軸・履歴コメント)のタスクは無し。TASK-368(Done, player-a.css を所有者単位に4分割)が同種の先行例。TASK-414(起動系のTailwind化, Done)、TASK-431/428.20(トークン整理, Done)は個別移行。docs に mll-/mle- の命名と @layer の説明あり。

評価: 『元ファイル順を保つため』『元ファイルでは連続した区画だったため』という経緯コメントと a/b/c 命名は、AGENTS.md の『経緯を書かない』『長期的視点』に反する実在の負債で、所有者単位への再編(TASK-368 と同じ手法)は妥当。ただし提案③の『Tailwind 側へ段階的に寄せ mle-/mll- を縮小』は大規模移行になりやすく、現状 docs で棲み分けが定義済みなので、まず a〜e 分割の解消(所有コンポーネント単位への再編と履歴コメント削除)に絞るのがよい。ソース順依存の洗い出しは再編時に必須の確認項目。high は過大で medium。

探索時の提案: ①元ファイル順依存を解消するため、競合する同詳細度ルールを洗い出して詳細度/レイヤーで明示的に解決し、ソース順依存をなくす。②CSS を『コンポーネント所有』(axis-rail.css, work-row.css, value-list.css, quick-overlay.css, player-dock.css…)に再編し、a/b/c 分割と履歴コメントを削除。③新規・改修は Tailwind+共通 shared/ui コンポーネントへ寄せ、mle-/mll- は段階的に縮小する方針(境界基準)を design-system.md に1箇所で書く。reduced-motion は1ファイルに集約。

## cli-ui-3 プレイヤーの状態機械が reducer と useEffect 内の可変 ref に二分され、遷移規則の一部がテスト不能なフック内にある

- 判定: partial / extends-known / severity medium
- 場所: client/src/features/player/model/useAudioEngineLifecycle.ts:52, client/src/features/player/model/useAudioEngineLifecycle.ts:77, client/src/features/player/model/useAudioEngineLifecycle.ts:146, client/src/features/player/model/useAudioEngineLifecycle.ts:176, client/src/features/player/model/playerRuntime.ts:29, client/src/features/player/model/playerController.ts:262

根拠（探索）: playerController.reducePlayer は純粋な reducer + command で整っているが、再生の実質的な状態は PlayerRuntimeRefs(trackEnded / loadedTrack / filesModeFileDurationSec / loadCleanup)に分散している。useAudioEngineLifecycle では ① trackEnded フラグが onPlay/onPause/onTimeUpdate/finishCurrentTrack で相互に読み書きされ(onPause は trackEnded 中は audioPaused を送らない、loop 時だけ false に戻す)、② 区間トラックの『仮想終端』判定 hasReachedTrackEnd と continuesSameAsset(assetUrl 比較)で engine.pause するか決め、③ loadTrack 内の reusesLoadedAsset 分岐が seek と audioTimeUpdated を直接 dispatch、④ 再生中の play() は play イベントが出ないため『wasAlreadyPlaying なら audioPlaying を自前 dispatch』する TASK-128 回避、が reducer の外にある。`as import("@mimimilli/shared").WorkspacePath` のキャストや `workId!` の非null断言も同箇所。audioTimeUpdated で AB 到達時に seekAudio を返すが、実 seek 完了前の timeupdate ごとに seek コマンドが再発行され得る(reducer 側に『seek 中』状態が無い)。

裏取り（検証）: useAudioEngineLifecycle.ts の記述はほぼ事実: trackEnded を onPlay/onPause/onTimeUpdate/finishCurrentTrack が相互に読み書き、continuesSameAsset(assetUrl比較)による engine.pause 判定、loadTrack 内の reusesLoadedAsset 分岐での seek と audioTimeUpdated の直接 dispatch、TASK-128 の wasAlreadyPlaying 回避、`as import("@mimimilli/shared").WorkspacePath` キャストと `workId!` 非null断言(L170-173付近)も実在。loadedTrack/filesModeFileDurationSec/loadCleanup が PlayerRuntimeRefs(playerRuntime.ts)にあるのも事実。一方『実 seek 完了前の timeupdate ごとに seek コマンドが再発行され得る』は reducer(L312-318)が AB到達時に positionSec を a へ更新して seekAudio を返すため成立し得るが、seek は冪等で実害は小さい(推測の域)。『reducer のテストでカバーできず実ブラウザでしか確認できない』は誇張で、フックはengineを注入できる構造で結合テスト可能。

既知との関係: TASK-368(Done, 挙動不変の構造リファクタ。ref 側の遷移規則は対象外)・TASK-428.16(Done, 再生状態表示の統一)・DRAFT-57(trackTime branded化)。ref にある trackEnded/仮想終端/同一音源継続の reducer への取り込みを扱うタスクは無し。

評価: 設計上の指摘としては妥当で、状態の第二の置き場(refs)が TASK-128 のような手動収束パッチを生んでいるのは事実。ただし提案は controller state・入力イベントの再設計を伴い大きく、現状で顕在化している不具合(固着等)の報告は無い。着手するなら TASK-368 の続きとして『trackEnded と仮想終端判定を controller 側に引き上げる』に絞り、非null断言とキャストは LoadedTrack の判別共用体化で別途消すのが現実的。high は過大で medium。

探索時の提案: trackEnded・仮想終端・loadedTrack 同一音源判定を controller の状態(例 loaded: {assetUrl, trackId, endedGuard})と入力イベント(audioTimeUpdated に絶対時刻と trackBounds を載せる、assetReused 結果を loadSucceeded として返す)へ引き上げ、effect 側は engine の薄いイベント変換とコマンド実行だけにする。『再生中に play() が来た』ケースは controller が autoplay 時に status を確定させ、engine の冪等性に依存しない設計にする。非null断言とキャストは LoadedTrack を判別共用体にして消す。

## cli-ui-4 作品編集ダイアログが『snapshot 取り込み/競合解決の状態機械』『保存オーケストレーション』『3フィールドのフォーム』を1コンポーネントに抱え、隣の DlsiteEditor は別の保存モデルで同居している

- 判定: confirmed / extends-known / severity medium
- 場所: client/src/features/library/ui/preview/WorkEditDialog.tsx:167, client/src/features/library/ui/preview/WorkEditDialog.tsx:231, client/src/features/library/ui/preview/WorkEditDialog.tsx:262, client/src/features/library/ui/preview/WorkEditDialog.tsx:303, client/src/features/library/ui/preview/DlsiteEditor.tsx:240, client/src/features/library/ui/preview/DlsiteEditor.tsx:258, client/src/features/library/ui/preview/DlsiteEditor.tsx:51

根拠（探索）: WorkEditDialog は 587 行、useState を13個保持(acceptedSnapshot/processedRevision/pendingSnapshot/pendingChangedFields/conflictFields/keepMineFields 等)し、レンダー中に setState する reconcile 分岐、resolveConflictField、commitSavedSnapshot、save(PATCH)、handleSaveError(409再取得)、requestClose の3択プロンプト、3フィールドのJSXを全部持つ。URL行の追加/削除/編集と `if (urlValidationError) setUrlValidationError(null)` が3箇所で重複。DlsiteEditor(423行)は DlsiteDiffRow・DlsiteApplyDialog(portal+独自dialog)・本体を同居させ、コード保存/連携しない/適用を即時 mutation で確定しつつ、保存ボタンを持つ親ダイアログの isDirty に rjCode が含まれないため、RJコード入力中に閉じても未保存警告が出ない。fetchInfo は rjCode が違うと『取得』の副作用として黙って linkage を保存する。diffSource(coverKind:'unmeasured', cover:null の偽 Work Pick)が DlsiteEditor 本体と fetchInfo 内で2回手組みされている。STATUS_LABEL が DlsiteEditor から export され WorkInfoDialog が import している(ダイアログ間依存)。

裏取り（検証）: WorkEditDialog.tsx は 587 行で useState が13個(L180-198: acceptedSnapshot/processedRevision/titleDraft/tagsDraft/urlDrafts/urlValidationError/isUnsavedPromptOpen/saveError/projection/pendingSnapshot/pendingChangedFields/conflictFields/keepMineFields)。`if (urlValidationError) setUrlValidationError(null)` は L499/513/523 の3箇所で重複、isDirty は L213 で title/tags/urls のみで rjCode を含まず、DlsiteEditor(423行)は rjCode を内部 useState(L221)で持ち『コードを保存』と適用を即時 mutation で確定、親 L555 でレンダー。fetchInfo は rjCode 変更時に linkageMutation で黙って保存(L265-271)。diffSource 手組みは本体(L231)と fetchInfo(L277付近)の2回で事実。STATUS_LABEL は DlsiteEditor.tsx:38 で export され WorkInfoDialog.tsx:8 が import。タグ編集の2系統(WorkTagEditor/useWorkTagEditor は WorkDetail、WorkEditTagsField/useWorkEditTagsDraft は WorkEditDialog)も事実。useWorkEditDraft のようなフックは未存在。

既知との関係: TASK-456(Done, 一括draft保存。DLsiteの重い操作は対象外と明記し『RJ/VJコードの取得と保存を作品情報を取得ボタンへ統合する方向は撤回しない』とある)・DRAFT-47(保存モデル見直しのドラフト。RJコードフローの方向性を含む)・TASK-445(保存失敗テストのフレーク)・TASK-452/428.17(Done)。コンポーネント分割・STATUS_LABEL の置き場・rjCode が dirty 対象外で閉じる確認が出ない点は未カバー。

評価: 妥当。特に『rjCode 入力中に閉じても警告が出ない』『STATUS_LABEL のダイアログ間依存』『diffSource の重複』は具体的で小さく直せる。useWorkEditDraft のフック化はテスト可能性(TASK-445 のフレーク対策)にも効く。③は DRAFT-47 で既に『コード確定は取得ボタンへ統合』の方向が合意済みなので、dirty 対象に入れるのではなくその方向で閉じる挙動を決めるのが筋。④(タグ編集の1系統化)はドラフトの結論待ちなので本件では扱わず切り離す。

探索時の提案: ①useWorkEditDraft(snapshot 取り込み・reconcile・競合・dirty・save)をフック化し reducer+純関数でテスト可能にする。URL 行は UrlListField コンポーネントへ分離。②DlsiteEditor は『連携設定(即時)』と『取得→適用プレビュー』に分け、プレビューは共通 Modal を使い、STATUS_LABEL は entities/work へ移す。③DLsite節が即時確定であることを仕様として明示するか、rjCode を draft に含めて閉じる確認の対象にするかを決める。④DRAFT-47 の結論に合わせ、タグ編集を1系統に畳むかを判断する。

## cli-ui-5 仮想化リスト+roving tabindex+矢印キー移動が AxisValueRows / AxisValueQuickList / 作品一覧で別実装になっている

- 判定: confirmed / extends-known / severity medium
- 場所: client/src/features/library/ui/AxisValueQuickList.tsx:140, client/src/features/library/ui/AxisValueQuickList.tsx:166, client/src/features/library/ui/AxisValueQuickList.tsx:186, client/src/features/library/ui/AxisValueRows.tsx:110, client/src/features/library/ui/AxisValueRows.tsx:123, client/src/features/library/ui/AxisValueRows.tsx:132, client/src/features/library/ui/useRovingIndex.ts:1

根拠（探索）: QuickList(345行)と Rows(230行)は、同じ rows(AxisValueHierarchyRow)・同じ axisValueRowNav(getNextAxisValueRowIndex/nearestValueRowIndex)・同じ useVirtualList・useRovingIndex を使いながら、activeIndex state、firstValueIndex→targetIndex→rawRovingIndex→nearestValueRowIndex の算出、キー処理を各々手で複製している。フォーカス移動は Rows が共通の focusVirtualItem(shared/lib)を使うのに対し QuickList は ref+activeIndex+scrollToIndex+ダブル requestAnimationFrame の自前実装で、セレクタも `[data-flat-index]` と `[data-index] [data-quicklist-item]` と異なる。CSS 側も .mll-vrow__add / .mll-vtile__add / .mll-qlist__add の『opacity:0.35 → hover/focus-within で1』ブロックが同一コメントごと3回(library-d.css:505,581,776)、見出し行(.mll-vrow-heading と .mll-qlist__heading)も二重。ファイル内に『統括判断』という内部経緯コメントも残っている(AxisValueQuickList.tsx:213)。

裏取り（検証）: AxisValueQuickList(345行)と AxisValueRows(230行)は、いずれも useVirtualList・useRovingIndex・getNextAxisValueRowIndex/nearestValueRowIndex を使い、activeIndex state と firstValueIndex→targetIndex→rawRovingIndex→nearestValueRowIndex の算出(Rows L110-123 / QuickList L140-166)を同形で複製しているのは事実。フォーカス移動は Rows が focusVirtualItem(shared/lib)、QuickList が activeIndexRef+scrollToIndex+ダブルrAF の自前実装でセレクタも `[data-flat-index]` と `[data-index] [data-quicklist-item]` で異なる。library-d.css の opacity: 0.35 ブロックは L507/582/777 の3箇所で事実。『統括判断』コメントは library-d.css:517 と AxisValueQuickList.tsx:252 にあり(指摘は :213 だが行ずれ許容)。

既知との関係: TASK-436(Done)は『値一覧とファイル行のキーボード操作を作品一覧と揃える』で、AC#4『gridNavigation/useWorkListKeyboardNav/focusVirtualItem を再利用し重複していない』を満たしたとして完了しているが、実際は QuickList に自前実装が残っており一部未達。TASK-428.12(Done, 作品・値・トラック一覧のキーボード操作共通化)。行シェル/CSS の重複(0.35 ブロック3回、見出し行2種)を扱うタスクは無し。

評価: 妥当。TASK-436 の意図(実装重複なし)が QuickList で守られていない点を具体的に突いており、フック化(useVirtualRovingList 相当)と QuickList のダブルrAFを focusVirtualItem へ寄せる部分は筋が良い。AxisValueRowShell による行/タイル/クイックの共通化は variant が3種に増えるため、まずフック統一とCSS重複の1ブロック化に絞るのがよい。『統括判断』の内部経緯コメントは削除する。

探索時の提案: useVirtualRovingList(rows, isFocusable, resetKey) を shared か library/model に作り、activeIndex・rovingIndex・focusRow(スクロール→フォーカス)・矢印処理を一元化。Rows/QuickList/作品一覧はそれを使い、QuickList の ダブルrAF 自前処理は focusVirtualItem へ寄せる。AND追加ボタン付き行は共通の AxisValueRowShell(行/タイル/クイックで variant)にして CSS も1ブロックへ。

## cli-ui-6 フォーム/表の基本部品(Select・ラベル・インライン編集入力・テーブルセル)が shared/ui に無く、Tailwind 文字列の複製とドキュメント例外で回している

- 判定: partial / extends-known / severity low
- 場所: client/src/features/library/ui/SmartFolderEditorModal.tsx:40, client/src/features/library/ui/SmartFolderRuleCard.tsx:16, client/src/features/scan/ui/scanModal/UnregisteredTab.tsx:216, client/src/features/scan/ui/scanModal/UnregisteredTab.tsx:249, client/src/features/scan/ui/scanModal/ScanResultWorksTable.tsx:90, client/src/features/library/ui/preview/WorkEditDialog.tsx:437, client/src/features/library/ui/preview/DlsiteEditor.tsx:358

根拠（探索）: `h-8 rounded-[6px] border border-line bg-paper-1 px-2.5 font-jp text-body text-ink-0 focus-visible:border-line-strong` が SmartFolderEditorModal と SmartFolderRuleCard にそれぞれ selectClass として同一定義され、3箇所の `<select>` に使われる(shared に Select なし)。ラベル見出し `font-sans text-label font-semibold text-ink-1` が WorkEditDialog(3)/WorkInfoDialog(2)/DlsiteEditor(1)に直書き。インライン編集の `<input>`(`rounded-[4px] border bg-paper-2 px-1.5 py-0.5 ... border-acc / border-[var(--r-coral)]`)が UnregisteredTab と ScanResultWorksTable で別々に手書きされ、Enter/Escape(`isComposing` 判定・stopPropagation)の同じコメント付きキー処理も2回。表ヘッダー `border-b border-line-soft px-2.5 py-1.5 font-sans font-semibold text-ink-2` が UnregisteredTab 内で5回。design-system.md は『TextInput の形に合わない文字入力は対象外』と例外を許している。

裏取り（検証）: selectClass が SmartFolderEditorModal.tsx:40 と SmartFolderRuleCard.tsx:15 に定義され、select は計3箇所(RuleCard 2、EditorModal 1)で事実、shared に Select は無い。ラベル `font-sans text-label font-semibold text-ink-1` は WorkEditDialog 3/WorkInfoDialog 2/DlsiteEditor 1 で事実。UnregisteredTab の表ヘッダー `border-b border-line-soft px-2.5 py-1.5 font-sans font-semibold text-ink-2` は th が5〜6個(チェックボックス用1個はクラスが一部異なる)。インライン編集 input は UnregisteredTab と ScanResultWorksTable で別実装(padding も px-1.5 と px-2 で不一致)、Escape の同コメント付き処理も2回あるのは事実。IME差も事実: UnregisteredTab の handleEditKeyDown(L217)は isComposing を判定、ScanResultWorksTable の onKeyDown は判定なしで、IME変換中の Enter で saveTitle が走り得る実害ありのバグ。design-system.md L47 に TextInput の形に合わない入力は対象外とする例外条項が実在。NeedsAttentionTab にも同形の th が4個ある(指摘外)。

既知との関係: TASK-447.24(Done, 文字入力を TextInput に共通化。インライン編集は意図的に対象外)・TASK-428.19(Done, 未登録候補のタイトル/RJ編集の安全化)・428.23・428.21。Select/FieldLabel/InlineEditInput/DataTable の共通化は未カバー。ScanResultWorksTable の IME 判定漏れを扱うタスクは見当たらない。

評価: IME判定漏れ(ScanResultWorksTable のタイトル編集)は実在する具体的バグなので、InlineEditInput 相当(Enter/Escape/IME を内包する共通フック)を作って2箇所を統一する部分だけは価値が高い。一方 Select は3箇所、FieldLabel は6箇所でどれも小規模なため DataTable プリミティブまで含めた『フォーム部品の正本』化は過剰になりやすい。Select/Label/Table は重複が増えた時点でよく、まず inline 編集の挙動統一(バグ修正を兼ねる)に絞る。全体として low。

探索時の提案: shared/ui に Select、FieldLabel、InlineEditInput(IME対応のEnter確定/Escape取消・error variant をフックで内包)、DataTable(thead/td プリミティブ)を追加し、TextInput とあわせ『フォーム部品の正本』にする。design-system.md の例外条項を削り、inline 編集は InlineEditInput に集約する。

## cli-ui-7 z-index とバックドロップ色などのレイヤー値が CSS/tsx に魔法数で散在し、正本が docs の表になっている

- 判定: confirmed / new / severity low
- 場所: client/src/styles/shell/player-dock.css:15, client/src/styles/shell/now-playing.css:28, client/src/styles/shell/now-playing.css:44, client/src/styles/shell/now-playing-immersive.css:12, client/src/styles/shell/player-popup.css:118, client/src/styles/shell/library-d.css:632, client/src/styles/shell/library-b.css:15, client/src/styles/shell/preview-a.css:364, docs/design-system.md:85

根拠（探索）: z-index は shell CSS に30/32/33/40/41/50/10 が直書きで32箇所、tokens.css に z 系トークンは無い。docs/design-system.md の『Overlay / z-index の現在の階層』表が人手で追う正本で、各CSS冒頭に『z-index の割り当ては docs を参照』のコメントが4ファイル、now-playing.css には『41: 没入面(40)より常に手前』という数値間の関係をコメントで保っている。ポップオーバー系(sortmenu=30, qoverlay=30, playmenu=10, ratepick=50)は共通基準が無い。

裏取り（検証）: client/src/styles 配下の z-index 宣言は合計32箇所で事実、tokens.css に z 系トークンは無し。主な値は 30(library-b, library-d)・32(player-dock, player-popup, now-playing)・33・40・41・50・10(preview-a)等。tsx 側にも z-10/z-20/z-30 の Tailwind 直書きが複数ある。docs/design-system.md の『Overlay / z-index の現在の階層』表と、now-playing.css の『41は没入面(40)より常に手前』のような数値間関係のコメントも実在。ただし32件のうち多くは 0〜4 の局所スタッキング(now-playing-immersive 内部など)で、トークン化が必要な層は 10/30/32/33/40/41/50 の約10件。

既知との関係: z-index トークン化は未起票。TASK-362/363/364/449 は z-index に触れるが対象は個別の重なり修正のみ。TASK-428.20/431(Done)のトークン整理は文字サイズ・色・フォーカスリングで z-index は対象外。

評価: 事実としては正しいが実害は薄い。個人開発のローカルアプリで重なり順の衝突は TASK-430 等で個別対応済み、モーダル/トーストは top layer で z-index に依存しない設計(design-system.md)。意味別トークン(--z-popover 等)に置き換えても、依存関係(41>40)を型やテストで守れるわけではなく、docs 表の更新負担が減るだけ。層が増えた時に検討すれば足り、いま着手する価値は低い。

探索時の提案: tokens.css に意味別の --z-popover / --z-player / --z-nowplaying-bg / --z-immersive / --z-immersive-seek 等を定義し、Tailwind theme にも出す。docs の表は削り、トークン定義へのリンクにする(ADRの記述は最小)。

## cli-ui-8 PlayerCoreState が controller state の非正規化コピー(派生フィールド+手書き比較器)で、状態の第二表現と型ガードで不変条件を再構築している

- 判定: partial / duplicate / severity drop
- 場所: client/src/features/player/model/playerController.ts:76, client/src/features/player/model/playerController.ts:411, client/src/entities/player/model/playerCoreState.ts:17, client/src/entities/player/model/playerCoreState.ts:34, client/src/entities/player/model/atoms.ts:21

根拠（探索）: PlayerControllerState(item/status/…)から toPlayerCoreState が isPlaying(=status が playing|loading)、currentTrackIndex、currentPlaylistId、currentWork、isFilePlayback、tracks を展開して playerCoreAtom に流す。参照同一性維持のため13フィールド分の playerCoreComparators を手書きし、tracks 比較は『保守的契約: 参照が異なる非空配列は false』という暗黙の約束に頼る(areTracksEqual)。item が無い/work もfileも無い状態を表すため isPlayerActive / hasResolvedPlaybackSource といった型ガードと『currentTrackIndex >= 0 && (currentWork !== null || isFilePlayback)』という文書化された不変条件が entities 側に必要になっている。派生 atom(playingFsPath/playingTrackRelPath 等)もそれぞれ isFilePlayback と index の組合せを再解釈する。

裏取り（検証）: toPlayerCoreState(playerController.ts:415)が item から isPlaying/currentTrackIndex/currentPlaylistId/currentWork/isFilePlayback/tracks を展開し、13フィールドの playerCoreComparators(L80-94)と areTracksEqual の『保守的契約』(L64-68)が実在し、entities 側に isPlayerActive/hasResolvedPlaybackSource の型ガード(playerCoreState.ts)が必要になっているのも事実。ただし『comparator の更新漏れは UI が再描画されない静かなバグになる』は誤り: playerCoreComparators は `satisfies PlayerCoreComparators`(全キーを要求するマップ型)で、PlayerCoreState にフィールドを足して比較器を書かないと型エラーになる。4箇所更新が必要という指摘も、型チェックで漏れは検出される。currentWork と isFilePlayback の同時成立を型で禁止できない点は、型ガード(ResolvedPlaybackSource)がある程度担保しており『できていない』は言い過ぎ。

既知との関係: TASK-368(Done)項目3・4で PlayerCoreState/型の entity 一本化と active view model(型ガード)化を実施済みで、今回の指摘の型ガード群はその成果物。『core state全体の判別共用体化はしない』と同タスクで明示的に見送っている。DRAFT-57 は trackTime の branded 化で別件。

評価: TASK-368 で判別共用体化を意図的に見送った判断の蒸し返し。コンパイラが比較器の網羅を保証しているため『静かなバグ』という主張の根拠が崩れており、selectAtom 等の細粒度購読へ全面移行する提案は大改修に対して得るものが小さい。対応不要。

探索時の提案: controller の PlaybackItem(source 判別共用体)を entities にそのまま公開し、Jotai 側は item/status/prefs を selectAtom 等の細粒度購読で分けて、手書き comparator と非正規化フィールドを廃止する。isPlayerActive 相当は item !== null に一本化する。

## tool-1 Windowsネイティブ要件に対し検証手段がなく、テスト・smoke基盤がPOSIX前提のまま

- 判定: partial / new / severity medium
- 場所: .github/workflows/ci.yml:8, client/tests/smoke/fixtures.ts:109, client/tests/smoke/fixtures.ts:121, client/tests/smoke/fixtures.ts:84, server/tests/rootReconfigurationContract.test.ts:89, server/tests/staticServe.test.ts:99

根拠（探索）: CIは ubuntu-latest のみ。smoke fixtures は spawn("pnpm", ...) をshellなしで起動（Windowsでは pnpm.cmd のため ENOENT）、killGroup は process.kill(-pid) による負PID（POSIXのプロセスグループ）前提、detached:true も同様。serverテストは chmodSync(unreadableRoot, 0o000) を無条件に使い（Windowsではno-opで期待失敗が起きない）、symlinkSync は権限が要る。パス例も /tmp/... のハードコードが多い。Windows は恒久要件だが、検証は『別PCに手動で受け渡し』のみ（TASK-345 は EBUSY 単発対応）。

裏取り（検証）: 事実はおおむね正しい。ci.ymlはubuntu-latestのみ（check-and-test と smoke の2job）。fixtures.tsはspawn("pnpm",...)をshellなしで起動し、detached:true と process.kill(-pid) のkillGroupはPOSIX前提。server testsはrootReconfigurationContract.test.ts:89のchmodSync(0o000)にplatformガードが無く、scannerUnreadable・workUnregisterも同様。staticServe.test.ts:99のsymlinkSyncも確認した。ただしWindowsで『一部赤のまま常態化』は未確認の推測。TASK-345がWindows並列realテストをIn Progressで扱っており、Windowsで実際にテストを走らせている形跡がある。smoke基盤をWindows対応する提案は、smokeがWSL/Linux前提のADR-0020運用と絡み範囲が大きい。

既知との関係: TASK-345（Windows並列realテストのEBUSY、In Progress）はtemp削除のみで部分重複。TASK-401/418（CI追加、Done）はLinuxのみ。windows-latest job追加を扱うタスクは無い。

評価: Windowsネイティブは恒久要件なので、CIにwindows-latestを足す方向は妥当。ただし最初の一歩は check + test:server + test:client に限るのが適切。POSIX専用テスト（chmod 0o000系）はplatform条件付きskipで足りる。smokeのWindows対応（vite createServer API化やtaskkill共通化）は効果が薄く過剰。smokeはLinux CIのみでよい。『high』は誇張で、手動の実機確認が回っている個人開発なのでmediumが妥当。

探索時の提案: CIに windows-latest のjob（check + test:server + test:client、可能ならsmoke）を追加し、POSIX前提のテストを『プラットフォーム条件付きskip＋理由』か抽象化で整理する。smokeのプロセス管理は pnpm/vite を node API 直接起動（vite は createServer API、bun は spawn）に寄せ、tree-kill相当（cross-spawn/taskkill）を共通ヘルパー化してWindowsでも動く形にする。

## tool-2 CIが本番ビルド（vite build / Bun一体配信）を一度も実行しない

- 判定: confirmed / new / severity medium
- 場所: .github/workflows/ci.yml:26, package.json:29, client/package.json:10, client/vite.config.ts:52, client/playwright.config.ts:1

根拠（探索）: ciは `pnpm check && pnpm test` と `pnpm test:smoke` のみ。client の check は `tsc`（noEmit）で `vite build` を含まない（build は `tsc && vite build`）。smokeは Vite dev server + Bun fixture の2プロセスでViteのdevモードを対象にしており、ADR-0018/0024の本番経路（dist を Bun が圧縮アセット込みで配信）は staticServe.test.ts のユニット水準のみ。vite.config の compression プラグイン・assetsInlineLimit などビルド固有設定は検証対象外。

裏取り（検証）: CIは pnpm check && pnpm test と pnpm test:smoke のみ。client の check は tsc で vite build を含まない。smokeはVite dev＋Bun fixtureの2プロセス構成で、本番経路（dist配信）は staticServe の単体テストのみ。vite.configのcompressionプラグインとassetsInlineLimitはどの検証にも入っていない。これらは実コードで確認した。

既知との関係: TASK-370/371/372（本番ビルド一体配信・性能・圧縮、Done）は実装・計測のみでCI検証は含まない。TASK-418はdev経路のsmoke追加。『CIでbuildとdist経路を検証する』という側面を扱うタスクは無い。

評価: CIに pnpm --filter client build を足す提案は低コストで妥当。ビルド専用の失敗を早く拾える。smokeをdist+Bun配信へ切り替える案は、smoke基盤の単純化（Viteプロセスとwarm-up不要）にもなり長期的には筋が良い。ただしHMR/devでしか出ない問題との兼ね合いがあり、まず build step の追加で十分。『high』は個人開発では過大でmedium。tool-5の提案と同じ方向なので、実施するなら1つにまとめる。

探索時の提案: CIに client build を含め、smoke（少なくとも主要シナリオ1〜2本）を `vite build` 済み dist を Bun が配信する経路（preview:fixture 相当）に対しても実行する。Vite devサーバー前提のwarmUp/optimizeDeps回避ロジック（fixtures.ts:77-95）も不要になり、smoke基盤が単純になる。

## tool-3 テスト専用エンドポイント POST /api/__test__/reset が本番appへ常設され、再設定ガード許可リストにも混入

- 判定: partial / new / severity low
- 場所: server/src/app.ts:34, server/src/app.ts:104, client/tests/smoke/fixtures.ts:205

根拠（探索）: fixtureアダプタに resetFixtureState があると `/api/__test__/reset` が登録され、ROOT_RECONFIGURATION_ALLOWED_REQUESTS（本番のroot再設定ミドルウェアの許可リスト）にもテスト用ルートが書かれている。ADR-0029の許可リストの意味づけ（再設定画面に必要な要求）とテスト基盤が同じ定数で結合。reset内部で3種のジョブマネージャのキャンセルを直書きしており、ジョブ種別が増えるたびに app.ts とテストの両方を直す必要がある。

裏取り（検証）: app.ts:34-38の ROOT_RECONFIGURATION_ALLOWED_REQUESTS に POST /api/__test__/reset が入っていることと、app.ts:102-110の登録は確認した。ただし『本番appへ常設』は誇張。登録は adapter.resetFixtureState がある場合のみで、実装は fixtureアダプタ（adapters/fixture/index.ts:23）だけ。realアダプタでは登録されない。許可リストのコメントも『再設定画面とfixtureのテスト間分離に必要なもの』とADR-0029由来で意図的。reset内の3マネージャ個別cancelは事実。一方 shutdown() も同じ3マネージャを個別に呼んでおり、集約余地があるのも事実。

既知との関係: TASK-408（resetが実行中ジョブを止めない、Done）は挙動修正。TASK-469は再設定ワークフロー。エンドポイントの配置責務を扱うタスクは無い。

評価: テスト用ルートを別アプリへ切り出すのは小さな設計改善にはなるが、実害は薄い（realでは登録されない）。ジョブマネージャ3種のcancelを束ねるヘルパー化は、shutdownと共通化できるので妥当で小さい。エンドポイント分離まで進めると、fixtureアダプタ専用エントリを増やす過剰設計の気味。低優先で、ジョブ種別が増えるタイミングで直せばよい。

探索時の提案: テスト用reset/シナリオ制御はfixtureサーバー専用エントリ（別Honoアプリ/ルートモジュール）に分離し、本番createAppは関与しない。ジョブ停止は各マネージャを束ねる単一の `shutdownJobs()` 相当に集約して shutdown 経路と共有する。

## tool-4 unit/vitest設定がportless CLIの起動結果に依存している（設定ファイルのeager評価）

- 判定: confirmed / new / severity medium
- 場所: client/vite.config.ts:9, client/vite.config.ts:31, client/vite.config.ts:52, client/vite.config.ts:67

根拠（探索）: resolveApiProxy() は defineConfig 内で `server: command === "serve" ? { proxy: { "/api": resolveApiProxy() } }` として即時評価される。vitest も command==='serve' で設定を読むため、`pnpm test:client` の度に（MIMIMILLI_BACKEND_URL未設定なら）execFileSync("portless", ["get", ...]) が走る。Windows向けの shell:true 分岐も設定ファイルに入っている。

裏取り（検証）: vite.config.tsは defineConfig(({command}) => ...) で server: command === "serve" ? { proxy: { "/api": resolveApiProxy() } } を即時評価する。MIMIMILLI_BACKEND_URL未設定だと execFileSync("portless", ["get", service]) が走る（Windows向け shell:true 分岐も同ファイル内）。vitest設定は同じ vite.config.ts の test キーなので、vitest run でもこの評価が走る。vitest.config.tsは存在しない。いずれも実コードで確認した。

既知との関係: なし

評価: 妥当。unit testが外部CLI（portless）の存在に依存するのは設計上の欠陥で、proxyの遅延評価かvitest.config分離で直せる。小さな修正で、将来構想の一般化にもならない。環境変数だけを見る形への一本化も方針（フォールバックを持たない）に合う。実害は、portless未導入環境や更新時にclient unitが落ちうる程度なのでmedium止まり。

探索時の提案: vitest設定を vite.config から分離（vitest.config.ts）するか、proxy解決を `server.proxy` のconfigureフックなど遅延評価にして dev server 起動時のみ実行する。portless連携は scripts/ の起動ラッパー側（環境変数 MIMIMILLI_BACKEND_URL を渡す）に寄せ、vite.config は環境変数のみを見る形へ一本化する。

## tool-5 smokeの起動基盤が Vite dev＋手書きプロセス管理で肥大し、同種の導出ロジックが複数箇所に分散

- 判定: partial / extends-known / severity low
- 場所: client/tests/smoke/fixtures.ts:1, client/tests/smoke/derivePort.ts:1, client/tests/smoke/workerCount.ts:1, client/playwright.config.ts:1

根拠（探索）: fixtures.ts（約220行）がポート空き待ち、起動ログ正規表現待ち（日本語ログ『サーバーを起動しました』とViteの『ready in』文字列に依存）、実ブラウザwarmUp、プロセスグループkill、reset を全て自前実装。ポートは cwd ハッシュ→forbidden port表（80行近い定数）→ブロック割当と複雑で、ADR-0020のWSL blackhole対策も混在。smokeのポート衝突は TASK-433/464 など複数タスクで個別に追われている。

裏取り（検証）: fixtures.ts 213行、derivePort.ts 42行、FORBIDDEN_PORTSはderivePort.ts内。ポート空き待ち・ログ正規表現待ち（『サーバーを起動しました』『ready in』）・warmUp・killGroupの自前実装は事実。ただし『80行近い定数』は誇張で、derivePort.ts全体が42行。提案の『Playwright webServer設定に任せ、readinessはHTTPヘルスチェック』は現状と食い違う。現在はworker-scopedフィクスチャでの自前spawnで、webServerは使っていない。ADR-0020はWSL2のloopback blackholeのため、HTTP/TCPプローブを避けてログ待ちに意図的に切り替えたもの。/api/health は存在しない。ヘルスチェック化はADR-0020と衝突する。

既知との関係: TASK-464（空きポート動的確保でderivePort/FORBIDDEN_PORTS廃止、To Do）がポート導出部分を完全にカバー。TASK-433は完了済みのforbidden対応。ADR-0018/0020はVite+Bun二重構成とログ待ちを決定済み。残る差分は『Viteプロセス廃止（dist配信smoke）』のみで、これはtool-2と重複。

評価: ポート部分はTASK-464で対応済み。HTTPヘルスチェック化はADR-0020に反するので不採用が妥当。Vite二重プロセス廃止はtool-2（dist配信smoke）に吸収して判断すればよく、独立した所見としての価値は低い。

探索時の提案: ポートは0番bindで動的確保しPlaywrightのwebServer設定（または1回の起動ヘルパー）に任せ、readinessはHTTPヘルスチェック（/api/health相当）にする。サーバーはBun一体配信（tool-2）に統一してViteプロセスを廃止する。derivePort/forbidden表は丸ごと不要になる。

## tool-6 サーバーテストが bun:test ではなく node:test を110ファイルで使い、巨大なフラット構成になっている

- 判定: partial / new / severity low
- 場所: server/package.json:68, server/tests/preload.ts:1, server/tests/real/metaCasRace.test.ts:4, server/tests/real/metaCasRace.test.ts:123

根拠（探索）: `bun test tests --parallel` で実行しているが、`from "node:test"` を使うファイルが110、`bun:test` は5のみ。タイムアウトは bun:test の setDefaultTimeout（preload）で与えており、node:test 側へ適用されるかはBunの互換層任せ（コメントにも『Bun 1.3 has no [test].timeout key』と回避策がある）。tests直下に約60ファイルが種別（fixture契約・route・純粋関数）混在でフラットに並び、real/ transport/ のみ分類されている。metaCasRace.test.ts の withCasDelay は env MIMIMILLI_ATOMIC_WRITE_CAS_DELAY_MS を設定するが server/src に参照が無く、withCasDelay(0, ...) のみ呼ばれる死んだ仕組み。

裏取り（検証）: node:testのimportは110ファイル、bun:testは5ファイルで数は正しい。tests直下は60エントリ（real/やtransport/等のディレクトリを含む）。metaCasRace.test.tsのwithCasDelayはENV MIMIMILLI_ATOMIC_WRITE_CAS_DELAY_MSを設定するが、server/srcに参照は無く、呼び出しは withCasDelay(0, ...) の1箇所のみで、死んだ計装であることは確認した。一方『Bun互換層任せで信頼性に直結』は推測。bun test がnode:testを実行する互換層は公式機能で、実害の証拠は無い。

既知との関係: TASK-419（CASレース実測、Done）が withCasDelay の出所。除去は未対応。ランナー統一・ディレクトリ再編を扱うタスクは無い。TASK-422/434はタイミング修正で別物。

評価: 死んだwithCasDelayとENV名の削除は妥当で小さいので、そこだけ拾えばよい。110ファイルのbun:test機械置換やディレクトリ再編は実害に対して大きすぎ、過剰。Windowsでも実行しているためnode:testのままで可搬性も保たれている。severityはlowのまま、実質は『死コード削除』だけ。

探索時の提案: ランナーを一本化（bun:test へ機械置換、または node --test 実行に揃える）し、tests直下を unit / contract(fixture・real共通) / route に分類して配置する。metaCasRace の withCasDelay とENV名は削除する。

## tool-7 clientのテスト・設定ファイルが型チェック範囲外（tsc が非ビルドモードで references を辿らない）

- 判定: confirmed / extends-known / severity low
- 場所: client/package.json:9, client/tsconfig.json:25, client/tsconfig.json:26, client/tsconfig.node.json:12

根拠（探索）: client の check は `tsc`（-b なし）で、tsconfig.json は include:["src"] のため tests/ は対象外。さらに references の tsconfig.node.json（vite.config.ts を含む）も -b なしでは検査されない。一方 server は tests/bench まで include している。

裏取り（検証）: client の check は tsc（-bなし）、tsconfig.json は include:["src"]で、tests/ は対象外。references に tsconfig.node.json（include: vite.config.ts）があるが、-bなしでは参照先は検査されない。server/tsconfig.jsonは src・tests・bench を含む。いずれも確認した。

既知との関係: TASK-283（clientのテストを型チェック対象に含める、To Do）がtests/をカバー。tsconfig.node.json／vite.config.tsが未検査という点は同タスクに含まれず、extends-known。

評価: vite.config.tsの未検査はTASK-283のスコープに足せば済み、別タスクにするほどではない。tsc -b化と app/tests/node の3分割は妥当な整理。TASK-283側で一緒に直すのが筋。

探索時の提案: tsconfig を app/tests/node に分け `tsc -b` で全て検査する。vitest globals の型を tests 側に限定する。

## spec-1 requirementsの画面・スキャン仕様が実装から乖離し、同一文書内でも矛盾している

- 判定: confirmed / new / severity medium
- 場所: docs/requirements-v4.md:279, docs/requirements-v4.md:287, docs/requirements-v4.md:356, docs/requirements-v4.md:148, docs/requirements-v4.md:374, docs/requirements-v4.md:350, docs/requirements-v4.md:200, client/src/app/ui/LeftNav.tsx:50, server/src/adapters/real/scanner.ts:547

根拠（探索）: (1) 7.1/7.7は「フル画面プレイヤー（拡大ボタンで展開）」を現行仕様として記述するが、同文書5.2は再生中タブ（旧dialogは廃止、TASK-364）を記述しており自己矛盾。7.2は「再生中」を無効の近日実装ボタンと書くが、LeftNav.tsx:50-62では再生中は有効で nowPlaying モードへ遷移する。(2) 3.5/8.1(5)は「スキャン時にメタファイルを自動生成」「サマリーに新規生成N件」と書くが、実装はscanが候補プールを作り、writeMetaFile(scanner.ts:586,647)はユーザーの登録操作(registerFolderWork/registerFileWork)でのみ呼ばれる。3.5の「単一ファイルは自動生成対象外・UIから手動作成」も registerFileWork が存在し ADR-0032 が単一ファイル形式を正式な配置としている点と食い違う。(3) 7.6「タグクリックでタグ軸への絞り込み遷移」と4.5「軸ドリル」はADR-0013/0012で廃止済みの旧仕様。(4) README先頭で「本書の要件が正」と宣言しているため、実装・ADRと食い違った場合にどちらが正か読み手が判定できない。

裏取り（検証）: 主張は実コードと一致。requirements 7.1(279行)と7.7(356行)は「フル画面プレイヤー/ポップアップから拡大でフル画面」と書き、同文書5.2(233行)は「展開操作で再生中タブへ遷移」と書く自己矛盾。7.2(287行)は再生中ボタンを無効・近日実装とするが、LeftNav.tsx:50-62では再生中だけ有効でnowPlayingへ遷移し、無効なのは他の横断サーフェスのみ。3.5(148行)・8.1(5)(374行)は「スキャン時にメタファイル自動生成」だが、writeMetaFileはscanner.ts:586,647の2箇所のみ。ただし登録操作側(registerFolderWork/registerFileWork)からの呼び出しである点は私は未確認で、scanner.ts内にあることまでを確認した。3.5(161行)の「単一ファイルはUI手動作成」も registerFileWork(workRegister.ts)が存在するので古い。7.6(350行)の「タグクリックでタグ軸への絞り込み遷移」は旧仕様(ADR-0013はクリックで完全置換、TASK-358)。冒頭注記(3行)は「本書の要件が正」と宣言しており優先順位の問題も実在。

既知との関係: TASK-409(Done)は重複ID・非対応音声・ポップアップドラッグ・ヘッダー再スキャンのみ。TASK-364(Done)は全画面廃止の実装側で、requirementsの7.1/7.2/7.7更新は含まれない。TASK-391/447.29(Done)も別箇所。3.5/8.1/7.6/7.2を扱うタスク・ドラフトは検索で見つからず。

評価: 事実は正しく、requirementsを「正」と宣言したまま古いのは、エージェントが旧挙動を要求する実害につながる。ただし個人開発で、実害は文書読み手の誤誘導に限られるためhighは過大でmedium。提案のうち「ユーザーから見える振る舞いに絞る」「冒頭の優先順位を定義する」は妥当で、具体的な矛盾箇所(7.1/7.2/7.7/3.5/8.1/7.6)の書き換えがそのまま受け入れ条件になる。実装の後追い防止の仕組み(自動チェック等)までは求めず、書き換えと注記整理に留めるのが適切。

探索時の提案: requirementsを「ユーザーから見える振る舞い」だけに絞り、実装依存の記述（UI部品名・API名・ファイル名・px値）は削る。スキャン→候補→登録のフロー（3.5/8.1）、再生中タブへの一本化（7.1/7.2/7.7）、タグクリック遷移（7.6）を現行ADR(0013/0017/0032)基準で書き換える。要件と実装のどちらが正かの優先順位を冒頭で1行定義し、画面構成の詳細はdesign-system/実装に任せて重複記述を減らす。

## spec-2 HANDOFFのAPI表・smoke注記・プレイヤー節が現行コードと食い違い、手動維持の限界が出ている

- 判定: confirmed / extends-known / severity medium
- 場所: docs/HANDOFF.md:41, docs/HANDOFF.md:69, docs/HANDOFF.md:78, docs/HANDOFF.md:164, server/src/routes/settings.ts:13, server/src/routes/tagPrefixes.ts:36, server/src/routes/smartFolders.ts:21, client/playwright.config.ts:10, client/tests/smoke/workerCount.ts:3

根拠（探索）: HANDOFF.md:69は「共有fixture状態に依存するため直列実行が前提（workers:1 / fullyParallel:false）」と書くが、playwright.config.tsはfullyParallel:true・workers:SMOKE_WORKERS(=4、TASK-383)。API表は「GET / PUT /settings」だがsettingsルートはGETのみ（PUTなし）。PUT /tag-prefixes/order と POST /smart-folders/preview が表に無い。164行の「model/atoms.ts」はfeatures/player/model配下に存在せず、実体はentities/player/model/atoms.tsとplayerPresentationAtoms.ts。表自身が「更新漏れしうる。shared/srcを直接確認すること」と断っている。TASK-409はAC#1「HANDOFFのAPI表・smoke並列前提が現行コードと一致」を完了にしているが、現在は再び不一致。

裏取り（検証）: HANDOFF.md:69は「直列実行が前提（workers:1 / fullyParallel:false）」だが、playwright.config.tsはfullyParallel:true・workers:SMOKE_WORKERS。API表の「GET / PUT /settings」は、settings.tsにapp.getのみ(13行)でPUTなし。PUT /tag-prefixes/order(tagPrefixes.ts:36)とPOST /smart-folders/preview(smartFolders.ts:21)は表に無いと主張されており、表を全面再確認はしていないが、routeの実在は確認した。164行付近の「model/atoms.ts」は features/player/model には無く、実体は entities/player/model/atoms.ts と playerPresentationAtoms.ts(features側)。HANDOFFのプレイヤー節はfeatures/player/model配下のファイル群の記述として書かれており、atoms.tsの所在だけ不整合。SMOKE_WORKERS=4はworkerCount.tsの値で未検証だが、config側の食い違いは確実。

既知との関係: TASK-409/391/447.29(いずれもDone)の対象箇所の再発。TASK-409のAC#1がAPI表とsmoke並列前提の一致を完了済みとして主張している。HANDOFFを今後どう維持するか（表の廃止）を扱うタスクは見つからず。

評価: 事実は正しい。表自身が更新漏れしうると断っており、手動同期は構造的に追従できないため、API表の削除とsmoke注記を設定ファイルへの参照に寄せる提案は長期的に正しく過剰設計でもない（削除はむしろ簡素化）。プレイヤー節も、ファイル列挙を減らして不変条件のみ残す方向で妥当。入口文書の誤情報なのでmedium維持。「生成スクリプトを用意」は不要で、削除だけで足りる。

探索時の提案: API表を削除し「契約の正典はshared/src、ルート一覧はserver/src/routes」の1行に置き換える（必要なら一覧を生成するスクリプトを用意）。プレイヤー節のファイル単位の列挙は削り、不変条件（高頻度atomを3 leafだけが購読する等）だけを残す。smoke注記は設定ファイルへの参照だけにして数値や並列前提を転記しない。

## spec-3 dlsite.mdがジョブ/SSEのリファクタ後の現状と食い違う

- 判定: confirmed / new / severity low
- 場所: docs/dlsite.md:52, docs/dlsite.md:231, docs/dlsite.md:239, docs/dlsite.md:241, server/src/routes/dlsite.ts:166, server/src/adapters/real/dlsiteBulk.ts, server/src/dlsiteJobManager.ts:171

根拠（探索）: dlsite.md:231は実装場所として存在しない `dlsiteProgress.ts` を挙げる。dlsite.md:52は一括取得を `runDlsiteBulk`（`index.ts`）が実行すると書くが、実体はadapter/dlsite.ts契約とreal/dlsiteBulk.ts、起動はDlsiteJobManager(dlsiteJobManager.ts:171)。dlsite.md:239は GET /dlsite/bulk を「なければ204」と書くが、routes/dlsite.ts:166は常に dlsiteBulkSnapshotSchema（current/lastTerminalを持つ）を200で返す（HANDOFFは正しく記述）。dlsite.md:241は /dlsite/events が接続時に『直近の進捗を再送』『直近の完了/エラーを1件返す』と書くが、ADR-0030は現在状態stateを1件送る方式に改めている。

裏取り（検証）: dlsite.md:231の「dlsiteProgress.tsに実装」は、server/src直下にdlsiteProgress.tsが無く(ls確認)、src配下でも該当なし。dlsite.md:52の `runDlsiteBulk`（`index.ts`）も古く、実体はadapter契約とDlsiteJobManager(dlsiteJobManager.ts)。dlsite.md:239の「GET /dlsite/bulkはなければ204」は、routes/dlsite.ts:166-168が常にdlsiteBulkSnapshotSchemaを200で返すので誤り。dlsite.md:241の「接続時に直近の進捗を再送／直近の完了/エラーを1件返す」は、ADR-0030:40-41の「接続時にstateイベントを1件送る」と食い違う。なお dlsite.md:52付近の「手動POST /dlsite/bulkはconflictで弾く」記述は routes/dlsite.ts の実装と一致しており、正しい。

既知との関係: TASK-470.2(Done、検索結果ではDoneで、所見の「未完了」は誤り)は受信履歴管理のprogress表示専用化で、docs更新は含まない。TASK-470.1(Done)・TASK-428.4(Done)も実装側。TASK-409はGET/DELETE /dlsite/bulkの追記のみ。dlsite.mdのジョブ・SSE節の書き換えを扱うタスクは見つからず。

評価: 事実は正しい。一方、所見のknown_overlapの「TASK-470.2（未完了）」はDoneで誤認。実害はdlsite.mdを読んだ人が誤解する程度で、ソース文書として参照頻度も高くないためmediumは過大でlow。提案(ジョブ・SSE・エンドポイント節の書き換え、エンドポイント一覧をshared/src参照に寄せる)は妥当で、spec-2と同じ方針。独立タスクではなく、docs乖離修正のまとめタスクに含めるのが良い。

探索時の提案: dlsite.mdのジョブ・SSE・エンドポイント節をDlsiteJobManagerとADR-0030/0027（jobId付きスナップショット）に合わせて書き換え、エンドポイント一覧はshared/src/dlsite.tsのスキーマ参照に寄せて重複記述を削る。

## spec-4 ADR-0008に廃止済み・未実装の移行手順が残り、ADR-0023と二重の正を作っている

- 判定: partial / new / severity low
- 場所: docs/adr/0008-persistence-topology-query-ownership-playback-ids.md:84, docs/adr/0008-persistence-topology-query-ownership-playback-ids.md:152, docs/adr/0008-persistence-topology-query-ownership-playback-ids.md:259, docs/adr/0008-persistence-topology-query-ownership-playback-ids.md:265, docs/adr/0008-persistence-topology-query-ownership-playback-ids.md:280, docs/adr/0023-in-place-migration-simplification.md:24

根拠（探索）: ADR-0008（293行、最長）は『旧単一DBからの移行順序』（.nextへの切替・migration marker・途中停止後の再実行）、resume v1の変換、『レガシーメタの手動移行』を詳述し、帰結にも『配布開始までにuser DBのforward migration・スナップショット・復元検証が必要』と残る。一方ADR-0023は候補DB copy→swap(databaseReplacement.ts)を廃止してin-place適用に一本化済みで、server/src内に.next/migration marker/resume v1変換の実装は存在しない（rg確認）。ADR-0008:257は『CAS/revisionは導入しない』とするが、正本メタにはsourceRevision(CAS)がADR-0017/0025で導入済み。さらに『後方互換・移行レイヤーを持たない』というプロジェクト方針とも合致しない手順が、現行決定の顔をして残っている。

裏取り（検証）: ADR-0008に「旧単一DBからの移行順序」(.nextへの切替・migration marker、259行付近)・resume v1変換・レガシーメタ手動移行(265-270行付近)が詳述されていること、server/src内にmarker/.next/resume v1変換の実装が無いこと(rg確認、ヒットはmarkerはworks.ts内の別用途のみ)は事実。ADR-0023がin-place適用に一本化済みで、帰結にも配布前提のforward migration要求が残る点も事実。ただし「CAS/revision非導入(280行)がsourceRevision(ADR-0017/0025)と矛盾」は誤り: 280行はデバイス間同期(DRAFT-22)での再生状態の競合解決の話で、正本メタのsourceRevision(CAS)とは別物。矛盾の根拠にならない。また「ADR-0008が後方互換方針と合致しない」は、手動移行手順をADRに残すのはAGENTS.mdが明示する運用なので、手順があること自体は方針違反ではなく、実装済みでない旧単一DB移行が現行決定の顔をしている点のみが問題。

既知との関係: TASK-356(Done)=ADR-0023でin-place化、TASK-463(Done)=ADR-0023補記、TASK-389(Done)=ADR-0008へ派生キャッシュ追記。ADR-0008の旧移行順序の整理を扱うものは見つからず。

評価: 旧単一DB移行は存在した旧設計の遺物で、実装されない以上削除が妥当(ADR README例外規定「事実と合わない記述は書き換える」に該当)。CAS矛盾の指摘は取り下げ、旧単一DB移行順序・resume v1・レガシーメタ手動移行(実際にユーザーが実行する必要があるのか要確認)の節の整理に絞る。ADRを読んだエージェントがmarker方式を実装する実害は低めなのでlow。

探索時の提案: ADR README の例外規定（事実と合わなくなった記述は書き換える）に従い、ADR-0008から旧単一DB移行順序・レガシーメタ手動移行・resume v1変換・CAS非導入の記述を削除または現行事実へ書き換え、ADR-0008を『トポロジー・検索所有権・再生ID』の決定に絞る。必要な手動移行手順があるなら独立した運用文書/ADRに移す。

## spec-5 ADR運用ルール違反の追記節と、部分置換の未整理が残っている

- 判定: partial / new / severity low
- 場所: docs/adr/README.md:17, docs/adr/0001-typescript-api-server.md:33, docs/adr/0002-mock-as-fixture-adapter.md:31, docs/adr/0005-tags-as-sole-attribute.md:68, docs/adr/0012-library-axis-as-value-browse.md:3, docs/adr/0013-tag-click-replaces-all.md:41, docs/adr/0016-view-axis-consolidation.md:22, docs/adr/0026-value-list-as-global-entry.md:5

根拠（探索）: adr/README.md:17は「現状節や修正履歴を同一ファイルに重ねる追記はしない」と定めるが、ADR-0001『現状（2026-07-10）』、ADR-0002『現状（2026-07-04）』、ADR-0005『追記（2026-07-31）』が存在し、0005の追記は削除済みのworkRepo.ts・ContentColumn.tsx・drill（0012で廃止）に言及して「ADR本文は追記で上書きされたものとして読む」と読み手に依存させる。ADR-0012は決定4が0016、§7が0013、決定1が0026、URL契約が0031で順に変更されているが、0012自体のステータスは『承認』のままで本文・関連欄に後続ADRへの参照が無い（片方向リンクのみ、rgで0012内に0013/0016/0026/0031の言及なし）。ADR-0005も同様に0012で一部改訂されたが未表示。ADRステータスには『一部置換』の語彙がない（廃止/承認のみ）。

裏取り（検証）: ADR運用ルール(README:17「現状節や修正履歴を同一ファイルに重ねる追記はしない」)に対し、ADR-0001「## 現状（2026-07-10）」、ADR-0002「## 現状（2026-07-04）」、ADR-0005「## 追記（2026-07-31）」が存在することは確認(行番号は0001:33/0002:31/0005:68で一致)。ADR-0005の追記が「本文は追記で上書きされたものとして読む」と書く点も事実。ADR-0012は「関連」に0005のみで本文中の0013/0016/0026/0031への参照はrgで確認できず、ステータスは「承認」のまま。ただし誇張がある: ADR-0013/0016/0026側の関連欄には「ADR-0012（本ADRで§7/決定4/決定1を改訂）」と明記され、被置換側(0012)へ辿れる逆リンクが無いだけで置換関係は文書化済み。ADR-0005→0012は「本ADRで一部改訂」と0012側に書かれているが、0005側の逆リンクは未確認。「ステータス語彙に『一部置換』が無い」はREADMEのテンプレート(承認/検討中/却下/廃止)上は事実。

既知との関係: 検索で該当なし。ADRの追記節整理を扱うタスクは見つからず。関連としてTASK-409/391が個別のADR乖離を直した程度。

評価: 追記節3件の削除と現行事実への書き換えは、ADR README自身の規則への違反の是正で妥当。0012に後続ADRへの参照を足す、またはステータスの語彙に「一部置換」を足す提案も軽く済み妥当。ただし値ブラウズ系を新ADRで畳み直す案は過剰で採らない。置換関係は新しいADR側の関連欄で既に追えるため実害は小さく、medium→low。

探索時の提案: 追記・現状節を削除し、現行事実に書き換える（ADR-0005のタグ軸整理は本文へ統合）。ステータスに『一部置換（ADR-00XX）』を許し、被置換側の関連欄から置換ADRへ辿れるようにする。値ブラウズ系はADR-0012に最新の決定を集約するか、置換関係を明示した新ADRで0012/0013/0016を畳む。

## spec-6 ADR-0006（モバイルUI）が到達経路を決めておらず、前提記述も実装と合わない

- 判定: partial / extends-known / severity drop
- 場所: docs/adr/0006-mobile-ui-strategy.md:3, docs/adr/0006-mobile-ui-strategy.md:21, docs/ARCHITECTURE.md:105, server/src/serve.ts:25

根拠（探索）: ADR-0006はスマホからの再生・ブラウズ・マーキングを承認（未実装）としているが、サーバーは127.0.0.1固定bind(serve.ts:25)で、ARCHITECTURE.md:105は『LAN公開は認証とセットで将来対応』とする。ADR-0006内に認証・LAN公開・配信経路への言及が無い（rgで認証/LAN/bind/リモート0件）。本文は『続きから再生は初期スコープ外』『UIは完全にデスクトップ前提』と書くが、resume・再生中タブは実装済みで、全画面プレイヤー展開もTASK-364で廃止済み。

裏取り（検証）: serve.tsは127.0.0.1固定bind(hostname: "127.0.0.1"、25行付近)、ARCHITECTURE.md:105近傍の「LAN公開は認証とセットで将来対応」の記述、ADR-0006内に認証・LAN・bind・リモートの語が無いことは確認(rg 0件)。DRAFT-3(リモートストリーミング拡張)・DRAFT-19/20/68がドラフトとして存在する。一方で「全画面プレイヤー展開もTASK-364で廃止済み」は誤読: ADR-0006の「タップで全画面プレイヤー展開」はモバイルUIの設計で、デスクトップの旧dialog廃止とは別。「続きから再生は初期スコープ外」はresumeがデスクトップで実装済みでも、モバイルの初期スコープ記述としては矛盾とは言えず、ADR冒頭の「次フェーズ最有力候補」の扱いも古くなっている程度。「UIは完全にデスクトップ前提」は現在も概ね正しい(@media少ない)。

既知との関係: DRAFT-3(リモートストリーミング拡張、認証・公開)、DRAFT-19/20/67/68(モバイル)が存在し、リモートアクセス前提の議論はDRAFT-3が担う。ADR-0006とDRAFT-3の依存関係を明記する提案はドラフト群の範囲で、実質既知。

評価: ステータスが承認(未実装)のADRは、将来構想を先に固定した形になっており、認証・LAN公開の依存が書かれていない点は指摘として一理ある。ただしモバイルはDRAFT-3/19/20/68で未着手が明示され、着手時にADRを再評価すれば足りる。指摘の半分(全画面・続きから再生)は誤読で、残りも実害が薄く、今ADRを書き換える価値は乏しい。dropが妥当。

探索時の提案: ADR-0006から古い前提記述を現状に合わせて書き換え、リモートアクセスと認証の決定をモバイルの前提条件としてADR上で明示（または先にリモートストリーミングのADRを立てる）。未着手なら、モバイル決定は着手時に再評価するドラフト扱いにしてADRの承認ステータスを避ける。

## spec-7 ARCHITECTUREのcore/層説明が実装の分け方と合わなくなっている

- 判定: partial / extends-known / severity low
- 場所: docs/ARCHITECTURE.md:61, docs/ARCHITECTURE.md:63, docs/ARCHITECTURE.md:67, server/src/core, server/src/adapters/real

根拠（探索）: ARCHITECTURE.md:63はcoreの構成物を worksQuery/axisFacets/smartFolder/resumeValidation/workRegistrationGuard の5つと列挙するが、server/src/core には dlsiteNotifications.ts・identityConflicts.ts・tagPrefixCandidates.ts・japaneseSortKey.ts も存在する。『サーバー内部は3層に分かれ、過剰なレイヤリングは避ける』と書く一方、adapters/real は60ファイル(10k行超、scanner.ts 665行・workQueryRepository.ts 655行・workRegister.ts 534行)で、プロセス内状態を持つサービス(ScanJobManager等)・DlsiteJobManagerがserver/src直下に平置きされ、3層図に現れない第4の層（application service）が文章でのみ説明されている。『前提の判定をreal/fixtureで分岐させない』の対象が増えるたびに本節が追従していない。

裏取り（検証）: ARCHITECTURE.md:63は core の構成物として worksQuery/axisFacets/smartFolder/resumeValidation/workRegistrationGuard を挙げる。server/src/core には他に dlsiteNotifications.ts・identityConflicts.ts・tagPrefixCandidates.ts・japaneseSortKey.ts が存在(ls確認)。japaneseSortKeyは本文の別の箇所(SQLの日本語ソートキー)で言及があり、列挙漏れというより文脈ごとの言及。adapters/real は60ファイルでファイル数は一致、行数は未測定。「3層図に現れない第4の層がある」は誇張: ARCHITECTURE.md自身が「プロセス内状態を持つアプリケーションサービス(ScanJobManager/DlsiteJobManager/RootReconfigurationWorkflow)はserver/src直下に置き…」と別項目で明記しており、文章でのみ説明という点は事実だが、記述漏れではない。

既知との関係: TASK-338(Done)=DataAdapterの業務規則をapplication serviceへ移す。TASK-421(Done)=レイヤー境界検査の一本化。層定義・coreの置き場所基準の文書化は含まれない。

評価: coreの列挙が不完全という点は事実だが軽微で、列挙を削除してディレクトリを正とする提案は簡潔で妥当。一方「application service層を図に追加」「coreに置く基準・adapters/real内のサブ分類を定義」は文書の肥大化と将来構想寄りで、過剰設計気味。実際は列挙の削除(1行)だけで十分。TASK-338の結果を受けた文書更新は完了済み(Done)なので「TASK-338の結果に合わせて書き直す」は根拠が弱い。

探索時の提案: 3層図にapplication service層を明示し、coreに置く基準（純粋・I/O無し・両adapter共通）とadapters/real内のサブ分類（repository/scan/dlsite等）を文章で定義する。coreの列挙は削除し、ディレクトリを正とする。TASK-338の結果に合わせて本節を書き直す。

## spec-8 docs/issues凍結アーカイブと README の「削除済み」履歴リストが運用ルールに反して積み上がっている

- 判定: partial / new / severity low
- 場所: docs/README.md:25, docs/README.md:29, docs/issues/README.md:3, docs/issues/2026-07-03-live-ui-ux-review.md:3

根拠（探索）: AGENTS.mdは『ドキュメントは追記で積み上げず、書き換え・削除で現在の状態を保つ。経緯はGit履歴・ADR・backlogに任せる』と定めるが、docs/issues/に17ファイル(約144KB)の凍結アーカイブを残し、docs/README.mdは『削除済み（Git履歴に残る）』として削除した文書ごとの理由・日付・移管先TASKを10行ほど列挙して増やし続けている。issues内には Status: todo のまま凍結された文書（live-ui-ux-review）があり、旧Rust server前提の内容も含む。

裏取り（検証）: docs/issues/は17ファイル(README含む)、144KBで事実。docs/README.mdは「削除済み（Git履歴に残る）」節に約10行を列挙している(25-45行付近)。docs/issues/README.mdは「2026-07-06凍結。新規追加・編集はしない」と、過去の作業記録アーカイブとして明示的に位置づけている。live-ui-ux-reviewは「Status: todo」のまま凍結されており、改善候補はBACKLOG.mdへ転記済みと本文にあるが、BACKLOG.mdは現存しない(backlog CLI移行済み)ため古い。ただし旧Rust server前提の内容を含むかは未確認。AGENTS.mdの「ドキュメントは追記で積み上げず…経緯はGit履歴・ADR・backlogに任せる」方針と、凍結アーカイブ+削除履歴リストは緊張関係にある。

既知との関係: TASK-451(Done)は調査タスクのみ。docs/issues削除や削除済み一覧撤去を扱うタスクは見つからず。AGENTS.mdの方針自体は既知。

評価: AGENTS.mdの「経緯はGit履歴に任せる」に照らせば、凍結アーカイブと削除済みリストは方針に反するため、削除自体は長期的に妥当で、削除コストは判断根拠にならない。ただしrgで旧設計を拾う実害は検索ノイズ程度で、個人開発では軽微。READMEのdocs/issues節と削除済み節を撤去し、docs/issuesを削除する単純な整理で足り、新たな仕組みは不要。low。

探索時の提案: docs/issues/を削除してGit履歴に任せ、README の削除済み一覧も撤去する（必要な教訓はADR/backlogに既に移管済みと明記されている）。READMEは現行正典の地図だけにする。
