---
id: doc-6
title: 構造点検-2026-10-02（server・shared・ジョブ）
type: other
created_date: '2026-10-02 11:45'
updated_date: '2026-10-02 11:45'
---
# 構造点検 2026-10-02（server・shared・ジョブ）

対象コミット 1c9f033c。8観点で探索し、観点ごとに実コードとbacklogで反証・重複確認した結果（もう一方の観点は doc-6 / doc-7 を参照）。行番号は点検時点のもので、後続のバグ修正で変わり得る。severity は検証後の値で、drop は対応不要と判断したもの。

## srv-arch-1 作品登録の実装が folder/file × 新規/復元 で4重に複製され、登録コマンドが Scanner に同居している

- 判定: partial / new / severity medium
- 場所: server/src/adapters/real/workRegister.ts:275, server/src/adapters/real/workRegister.ts:412, server/src/adapters/real/scanner.ts:547, server/src/adapters/real/scanner.ts:598, server/src/adapters/real/scanner.ts:614, server/src/adapters/real/scanner.ts:651, server/src/adapters/real/workRegister.ts:203, server/src/adapters/real/workRegister.ts:235

根拠（探索）: createWorkFromFolder (workRegister.ts:275-379) と createWorkFromAudioFile (412-507) は、orphaned meta 読み込み → MetaParseError→invalid_meta → identity 衝突判定 → metaPatch 構築 → dlsite 適用 → restore/register 呼び出し、の流れがほぼ逐語的に同一で、差分は metaPath の求め方と祖先登録チェックだけ。Scanner 側も registerFolderWork/registerFileWork/restoreFolderWork/restoreSidecarWork の4メソッドが同じ形（existsSync→draft meta→writeMetaFile→registerSingleWorkFromPrepared、snapshotForRestore 共有）。buildWorkRegisterPreview と buildFileWorkRegisterPreview も orphanedMeta 読み取りが重複。TASK-467 で配置形式(placement kind)をmetaPathから解決するようにしたが、登録コマンド自体は kind で分岐する2系統のまま残っている。さらにスキャン実行器である Scanner が登録・復元コマンド(5メソッド)と単一作品投影(projectMetaFile)を抱え、workMethods/workRegister/scanCandidateSession/dlsiteApply/dlsiteBulk のすべてが Scanner に依存する。

裏取り（検証）: 中核は事実。workRegister.ts の createWorkFromFolder(275-379) と createWorkFromAudioFile(412-507) は、orphaned meta 読込→MetaParseError→invalid_meta→identity衝突判定→metaPatch構築(title/tags/dlsite適用/urls差し替え)→restore/register 呼び出しがほぼ逐語的に同一で、差分は metaPath 求め方・祖先/子孫ガード・DLsite適用先ディレクトリ(workDir/parentDir)程度。Scanner(scanner.ts)の registerFolderWork/registerFileWork/restoreFolderWork/restoreSidecarWork も実在し(547-665)、restore 系は snapshotForRestore を共有。さらに snapshotForRestore 内にも identity 衝突判定(existing.physicalPath!==... restoreIdentityConflictError)があり、workRegister 側と二重実装になっている。buildWorkRegisterPreview/buildFileWorkRegisterPreview の orphanedMeta 読み取りも重複で事実。誤り: 「folder 側のみ rjCode 3分岐、file 側は detect のみ」は workRegister 層では誤りで、両方 detectRjCode のみ。3分岐(rjCode undefined/空文字/指定値)は Scanner.registerFolderWork の options.rjCode にあるだけで(候補登録経路用)、registerFileWork には無いので『Scanner層の folder/file 非対称』としては正しい。「4重」は workRegister の2系統×Scannerの2系統という数え方で、実際は『2系統の関数が上下2層で似ている』が正確。Scanner が登録・復元コマンドと projectMetaFile を抱え、workMethods/workRegister/scanCandidateSession/dlsiteApply/dlsiteBulk 等が Scanner に依存する点は事実(rg で確認)。

既知との関係: TASK-467(Done)は placement 確定のみで登録コマンドの統合は含まない。TASK-388(Done)は『スキャン実行と候補プール参照の分離』で本件(登録コマンドの Scanner 同居)は範囲外。TASK-338(Done)は resume/DLsite適用パッチ/登録ガード(assertRegistrationAllowed)のみ共通化済みで、orphaned meta 復元手順の共通化は含まない。TASK-423(Done)・TASK-472(To Do)は単一ファイル登録・ID重複解消で、本件の構造重複には触れていない。重複する未完了タスク/ドラフト/ADRは見つからず。

評価: 方向性は妥当。folder/file の登録は ADR-0032 で metaPath から kind が決まる設計になったので、kind を strategy に閉じ込めた単一登録実装に寄せるのは長期的に正しく、今後 TASK-472 等で同修正を2系統に入れる負債は実在する。ただし実害は『今の2系統が同期している限り顕在化しない保守コスト』で、致命ではないため high ではなく medium。提案は『WorkRegistrar＋小さなstrategy』『Scanner から登録・projectMetaFile を切り出す』の2段で、前者(workRegister 層の統合と identity 判定の1箇所化)を優先すべき。後者は Scanner 内に registerSingleWorkFromPrepared が密結合なので分割コストに見合うかは設計を要する。WorkProjector 新設までやるのは少し大きめ。evidence の rjCode 非対称の記述は訂正が必要。

探索時の提案: 登録を placement kind をパラメータに取る単一の WorkRegistrar（またはコマンド関数群）へ統合する。kind ごとに異なるのは metaPath 解決・初期 tracks・祖先/子孫ガードの3点だけを小さな strategy にして閉じ込め、orphaned meta 復元・DLsite適用・RJ検出・identity 判定は1実装にする。Scanner から registerFolderWork 等と projectMetaFile を外して『単一 meta の投影』用の独立サービス(例 WorkProjector)に移し、Scanner は全体走査だけを担当させる。プレビューも同じ kind 解決を共有する。

## srv-arch-2 fixture アダプタが real の登録・候補登録・投影の挙動と乖離しており、fixture では検証できない経路がある

- 判定: partial / extends-known / severity medium
- 場所: server/src/adapters/fixture/works.ts:117, server/src/adapters/fixture/works.ts:225, server/src/adapters/fixture/works.ts:243, server/src/adapters/fixture/settingsScan.ts:153, server/src/adapter/settings.ts:27, server/src/adapters/fixture/works.ts:103, server/src/adapters/real/settingsScanMethods.ts:78, server/src/adapters/fixture/works.ts:333

根拠（探索）: (a) 候補登録: SettingsAdapter.registerScanCandidates は onRegistered コールバックを受けるが、fixture 実装は `registerScanCandidates(items)` で第2引数を受けず一度も呼ばない。real は published ごとに呼び、app.ts が DLsite enqueue に配線している。(b) getWorkRegisterPreview: fixture は `/RJ\d{6,8}/i` の独自正規表現、tags は常に []、orphanedMeta は常に false。real は shared の detectRjCode と meta 読み取りで suggestedTitle/tags/orphanedMeta を返す。(c) projectWorkSource: fixture は常に published を返し、real の identity_conflict pending / error pending / catalogInserted を再現しない。(d) 未設定 root: real は requireRoot() が NotConfiguredError(409) を投げるが、fixture は `state.rootFolder ?? "/library"` を8箇所に直書き（works.ts:103,120,151,206,256,275 他）して未設定でも動く。(e) exportLibrary は real が summaries、fixture が composeWorks で形が別。

裏取り（検証）: (a) 事実: SettingsAdapter.registerScanCandidates(items, onRegistered?) に対し fixture settingsScan.ts:153 は `registerScanCandidates(items)` で onRegistered を受けず呼ばない。real は scanCandidateSession.ts:87 で published ごとに呼ぶ。(b) 事実: fixture getWorkRegisterPreview は /RJ\d{6,8}/i 独自正規表現、tags は常に [] 、orphanedMeta は常に false(works.ts:117-150)。real は detectRjCode と meta 読み取り。(c) 概ね事実: fixture の projectWorkSource/createWork/reassign は常に projection.status="published" を返し identity_conflict pending 等を再現しない。(d) 事実: `state.rootFolder ?? "/library"` は works.ts 103/120/151/206/256/275、settingsScan.ts:157、fsMethods.ts:64/101、classification.ts:118 など10箇所前後(findingの『8箇所』は少ないが誤差)。ただし FixtureState.rootFolder は string|null 型なので null の fixture シナリオが存在するかを確認したところ、scenarios.ts に rootFolder: null のシナリオは無く(rg 'rootFolder: null' ヒット無し)、?? "/library" は実際には到達しない型上のフォールバック。『未設定でも動く』という実害は現状発生していない(未設定 fixture シナリオ自体が無いため)。(e) 事実: exportLibrary の形は別(fixture works.ts:374 / real workMethods.ts:349)だが、契約上は同じ {data, warning} を返すので乖離とは言い難い。TASK-435 は Done。

既知との関係: DRAFT-56(fixture/real conformance test・Draft、対象ポートと粒度を決めてから起票する旨)とほぼ同じ問題意識。TASK-338(Done)は resume/DLsite適用/登録ガードのみ共通化済みでプレビュー規則・onRegistered 無視は範囲外と明記。TASK-447.26(Done)は DLsite欠落差分を shared 化し契約テストで縛った前例。TASK-435(Done)は identityConflicts 導線404のみ。srv-arch-4 の onRegistered 配線とも関連。

評価: 事実としては(a)(b)(d)が確認でき、特に(a)onRegistered 無視は『fixtureで登録後DLsite enqueueが再現されない』ので UI 検証の穴になる。ただし (a)は srv-arch-4 でコールバック自体を撤去する案と表裏で、独立の修正項目ではない。(d)の `?? "/library"` はフォールバックだが未設定シナリオが無いので実害が無く、requireRoot 集約は整理レベル。(b)の『純粋規則を core に出して共用』は妥当で、TASK-338 と同じ手法の延長として筋が良い。(c)の pending 系再現は fixture を real に近づけすぎると fixture の意義(軽量モック)を損なうため、DRAFT-56 で『どのポートのどの挙動を縛るか』を決める形で処理するのがよく、新規で『4点セット起票』するのは重複気味。high は過大、medium。proposal(4)のDRAFT-56起票は既存ドラフトの具体化として扱う。

探索時の提案: (1) fixture の root 参照を requireRoot 相当の単一関数に集約し、未設定は real と同じ NotConfiguredError を投げる。(2) 登録プレビュー・RJ検出・suggestedTitle 規則など『純粋に決まる部分』を core に出し両アダプタが共用する（fixture 側の正規表現を撤去）。(3) onRegistered のような副作用コールバックを DataAdapter 契約から外し（srv-arch-4）、fixture/real が同じ結果型(created/published)を返すことだけを契約にする。(4) DRAFT-56 の conformance テストを、登録・投影・候補登録・未設定rootの観測可能な挙動に対して起票し、fixture を real と同じシナリオで縛る。

## srv-arch-3 POST /dlsite/apply-missing(およびpreview) が長時間同期リクエストで、キャンセル不能かつroot再設定のdrainをブロックし得る

- 判定: partial / extends-known / severity low
- 場所: server/src/adapters/real/dlsiteMethods.ts:78, server/src/adapters/real/dlsiteMethods.ts:101, server/src/routes/dlsite.ts:127, server/src/routes/dlsite.ts:140, server/src/adapter/dlsite.ts:35, server/src/rootReconfiguration.ts:127, server/src/lib/rootReconfigurationLockMiddleware.ts:30

根拠（探索）: dlsiteApplyMissing/Preview は query.listSummaries(workIds) で全対象作品を取り、作品ごとに await fetch.fetchCachedDlsite（外部HTTP＋DlsiteScheduler のレート制限待ち）→ apply を直列に回す。AbortSignal も進捗も無く、DlsiteJobManager（取消・SSE・キュー対応）も通らず、HTTP リクエスト1本の寿命に収まる。一方 root 再設定の execute は `await this.drainAdmittedRequests()`（タイムアウトなし、「待機ループは設けない」）で受理済み非許可リクエスト全件の完了を待つため、このリクエストが走っている間 POST /root-reconfiguration が応答しない。同じ『DLsite 一括』でも runDlsiteBulk は job 化されており、モデルが2系統。

裏取り（検証）: 事実: dlsiteApplyMissing/Preview は query.listSummaries(workIds) の全件を for で直列処理し AbortSignal 未配線(dlsiteMethods.ts:101-160)、DlsiteJobManager を通らず HTTP リクエスト内で同期完了する(routes/dlsite.ts:127-150)。root 再設定 execute は await this.drainAdmittedRequests() でタイムアウト無し(rootReconfiguration.ts:127)、ミドルウェアは POST /api/root-reconfiguration 等を許可リストに入れつつ他の受理済みリクエストを gate に数える(app.ts:33-38, lib/rootReconfigurationLockMiddleware.ts)ので、apply-missing 実行中は root 再設定が drain 待ちになるのは事実。ADR-0029:46 にも『受理済み要求が完了するまで待つ』と設計として明記。誇張点: fetchCachedDlsite は resolveCachedDlsiteAttempt(キャッシュ命中)を先に見て、ミス時のみ network へ行く。docs/dlsite.md:38,46 によると apply-missing は『キャッシュ済みHTMLを再パースする』用途で、UI は preview で全作品を取得した後、選択した workIds のみで apply を呼ぶため、apply 自体はほぼキャッシュ命中で数分張り付くのは通常起きない。長時間化するのは主に preview(workIds 省略=全作品で未取得が多い場合)。ストリーミング body は next() 戻りで gate から抜けるため media/SSE は drain を塞がない。

既知との関係: TASK-404/406(Done)は DLsite一括取得(DlsiteJobManager 経路)のキャンセル・転送上限で本件の apply-missing 経路は対象外。TASK-403(Done)は apply-missing の不正JSON扱い。DRAFT-74(Draft)は DLsite 導線再設計で『差分確認後の明示適用＋一括承認』を採用済みと明記しており、apply-missing/preview の将来形そのものがここで再設計される可能性が高い。TASK-448.3(To Do)は DLsite ジョブSSE配信の route 切り出しで別件。ADR-0029 は drain を意図した設計。

評価: 『apply-missing/preview を job 化し signal を通す』は筋は良いが、DRAFT-74 で DLsite 適用導線(差分確認・一括承認・結果の見返し)が再設計される予定なので、その前に job 化するのは二度手間になりうる。実害も、個人用ローカルアプリで『大量未取得ライブラリで全作品 preview を押したとき root 変更が待たされる』程度で限定的。少なくとも signal 配線(c.req.raw.signal を adapter まで通す)は単体 apply では既に実施済み(routes/dlsite.ts:113)なので、preview/apply-missing も同様に揃えるだけなら小さい修正で済む。job 化は DRAFT-74 の決定後に判断すべきで、今は low。

探索時の提案: apply-missing / preview も DlsiteJobManager の1種別(mode)として扱い、runDlsiteBulk と同じ AbortSignal・progress・SSE に載せる。HTTP は 202+jobId で返す。少なくとも長時間処理を InFlightRequestGate の対象外にし、signal をアダプタまで配線して root 再設定の取消対象に含める。

## srv-arch-4 『登録後にDLsite取得へ渡す』アプリケーション規則がルート・アダプタ契約のコールバックに散在している

- 判定: confirmed / extends-known / severity medium
- 場所: server/src/app.ts:60, server/src/app.ts:77, server/src/routes/works.ts:83, server/src/routes/works.ts:97, server/src/routes/works.ts:118, server/src/routes/scan.ts:124, server/src/adapter/settings.ts:27, server/src/scanJobManager.ts:136, server/src/scanJobManager.ts:228

根拠（探索）: 『新規登録された作品を DLsite 'new' ジョブへ入れる』が5箇所で別条件のまま実装されている: works.ts の projection(`result.catalogInserted`)、POST /works(`projection.status==='published'`)、reassign(`published`)、scan 候補登録(`outcome.status==='published'` を adapter 内で判定し onRegistered を呼ぶ)、スキャン完了(`insertedWorkIds.length>0` で ScanJobManager.onCompleted)と root再設定の recordCompleted。トリガー条件の判定がルート層とアダプタ層に分かれ、DataAdapter 契約(registerScanCandidates の onRegistered)が副作用の配線口になっている。ScanJobManager も候補の list/register/exclude/restore を adapter への素通し委譲で抱え、ジョブ管理と候補ワークフローが同居（scanJobManager.ts:120-146）。

裏取り（検証）: 事実。app.ts:60-77 で DlsiteJobManager.enqueue('new') への配線が (1)ScanJobManager の onCompleted、(2)scanRoute の onCandidateRegistered、(3)worksRoute の onWorkRegistered の3系統に分かれ、works.ts では projection(result.catalogInserted:83)、POST /works(projection.status==='published':97)、reassign(published:118) の3箇所で条件が別(catalogInserted と status==='published' の違い)。候補登録は scanCandidateSession.ts:87 で adapter 内が outcome.status==='published' を判定して onRegistered を呼ぶ(ルート層とアダプタ層に判定が分散)。scanJobManager.ts:116/241 の insertedWorkIds.length>0 と root再設定の recordCompleted(rootReconfiguration.ts:153)も事実。ScanJobManager が registerCandidates/list/exclude/restore を adapter へ素通しする点も確認(scanJobManager.ts:120-146 付近)。fixture が onRegistered を無視していても型で気づけない点も事実(onRegistered は optional 引数)。

既知との関係: TASK-338(Done)の範囲外メモ『onRegistered・app.ts enqueue 接続は DRAFT-74 で決める』に直接該当。DRAFT-74(Draft)は『通常の物理スキャンから DLsite 取得を暗黙に enqueue しない。登録時にコードのある作品をまとめて取得する明示選択を置く』と採用済み方針を記録しており、現状コードにある『スキャン完了で自動 enqueue(insertedWorkIds→enqueue new)』と『候補登録で自動 enqueue』は DRAFT-74 の方針と矛盾する旧挙動。TASK-448.4(To Do, finalizeScan 呼び出し経路の一本化)は scan 完了側の一本化を扱うので部分重複。TASK-455(Done)は結果契約(正本確定・catalog反映・応答生成の区別)。

評価: 事実としては正しく、散在は実在する。ただし処方箋が問題で、DRAFT-74 の採用方針に従うと『登録後に自動で enqueue』という規則自体が撤去・明示選択へ置き換わる可能性が高い。その場合、WorkRegistrationService を新設して自動 enqueue を1箇所に束ねるのは、消える規則を整える過剰設計になる。先に DRAFT-74 の『登録時取得選択』を決めてコールバックごと撤去し、ScanJobManager の素通し委譲だけ別途整理するのが正しい順序。『先送りでなく今決めるべき』の主張は、DRAFT-74 の決定(=この規則の去就)が前提なので、起票するなら『DRAFT-74 の決定に従いonRegistered配線を撤去』のタスク化が適切。medium 維持だが、独立実装ではなく DRAFT-74 の実装タスクに含める扱い。

探索時の提案: 作品の登録・投影の結果を受けて後続ジョブを起動する責務を、app.ts 配線ではなく application service（例 WorkRegistrationService）に1箇所持たせる。サービスが adapter の createWork/projectWorkSource/registerScanCandidates を呼び、『catalog に新規行が増えた』を共通の結果型(例 inserted:boolean)で受けて DlsiteJobManager.enqueue を呼ぶ。DataAdapter から onRegistered を撤去し、ScanJobManager は純粋にジョブ管理へ戻して候補操作は別サービス(ScanCandidateService)へ移す。

## srv-arch-5 DataAdapter が設定・root再設定・スキャン・作品・分類・FS・メディア・DLsite を束ねた約60メソッドの単一インターフェースで、利用側が必要以上に依存する

- 判定: partial / new / severity low
- 場所: server/src/adapter/index.ts:30, server/src/adapters/real/index.ts:49, server/src/adapters/real/settingsScanMethods.ts:36, server/src/adapters/real/coverMediaMethods.ts:19, server/src/scanJobManager.ts:47, server/src/dlsiteJobManager.ts:38, server/src/adapters/real/userWorkStateRepository.ts:26

根拠（探索）: DataAdapter は8つの Adapter 型の交差型。ScanJobManager/DlsiteJobManager は DataAdapter 全体を受けて数メソッドしか使わず、RootReconfigurationWorkflow だけが Pick で絞っている（rootReconfiguration.ts:34）。real 側も createSettingsScanMethods が『設定取得・root解決・再設定の永続化・スキャン実行（Worker/メインスレッド2経路）・候補セッション状態(クロージャ変数 candidateSession)』を1ファイルに持ち、coverMediaMethods も『カバー記述子・workspace メディア・音声 locate・FS browse』を同居させる（ファイル名とは別の責務）。UserWorkStateRepository も bookmark/resume/tag prefix/smart folder/設定KV/候補除外の5集約を持つ。root 再設定の状態は user 設定KVに JSON 文字列で入れ、読み出し時に zod parse している。

裏取り（検証）: 部分的に事実。DataAdapter は adapter/index.ts で SettingsAdapter & RootReconfigurationAdapter & WorkAdapter & ClassificationAdapter & FsAdapter & MediaAdapter & DlsiteAdapter の7ポート交差(findingの『8つ』は誤り、Adapter メソッド総数は約61で『約60』は妥当)で、既にポート型に分割済み。ScanJobManager(scanJobManager.ts:38)・DlsiteJobManager(dlsiteJobManager.ts:34)は DataAdapter 全体を受け、RootReconfigurationWorkflow だけが Pick(rootReconfiguration.ts:28-37)で絞っているのも事実。ルート層(routes/*.ts)も全て DataAdapter 全体を受けている。real 側: createSettingsScanMethods(235行)は設定・root再設定・スキャン・候補を同居、coverMediaMethods.ts(126行)は cover/media/browseFs(113行)を同居、UserWorkStateRepository(327行)は bookmark/resume/tag prefix/smart folder/設定KV/候補除外の6系統を持つのも事実。ただし各ファイルは235/126/327行と小さく、責務の混在はファイル名の不一致(browseFs が coverMedia に居る)程度。root再設定状態を user設定KVに JSON で保存し zod parse する(settingsScanMethods.ts:164)のも事実だが、スキーマ検証を通しているので問題ではない。

既知との関係: TASK-338(Done)で『adapter は低水準portに専念』、ADR-0002/0018 の6ポート分割は済み(DRAFT-56 本文に『6ポート分割は完了』)。TASK-448(To Do)が『master 由来のライブラリ・サーバーの設計負債』の親だが、中身はスキャン完了経路等で本件とは別。重複する具体的タスクは見つからず。

評価: 過剰設計の寄り。個人開発のローカルアプリで adapter 実装は real と fixture の2つだけで、利用側が全メソッドを見ても実害が出ていない(fixture は全ポートを実装する必要があるが、それは契約そのもの)。『用途別ポート型 ScanPort/DlsiteBulkPort/RootReconfigurationPort』を足すのは、RootReconfigurationWorkflow が Pick で済ませている程度の局所対処で十分であることの裏返しで、新しい抽象を増やす割に利点が薄い。有益なのは (1) browseFs を coverMediaMethods から fs 側へ移す、(2) UserWorkStateRepository の6系統分割くらいで、ファイル名と責務の不一致の解消に留めるなら low。ジョブマネージャを Pick に絞るのは、テスト用モックが楽になる程度。

探索時の提案: 利用側の依存を Pick ではなく用途別ポート型（ScanPort / DlsiteBulkPort / RootReconfigurationPort など）として adapter/ に名前付きで切り出し、ジョブマネージャはそれだけを受ける。real は settingsScanMethods を『設定・root再設定永続化』『スキャン実行』『候補セッション』に分け、coverMediaMethods も media/fs に分ける。userWorkStateRepository は集約（SmartFolder/TagPrefix/UserSettings）単位に分割する。

## srv-arch-6 HTTP の Range/条件付きGET 実装と fixture 専用の synthetic メディアが routes/media.ts に直書きされ、同一分岐が重複している

- 判定: confirmed / extends-known / severity low
- 場所: server/src/routes/media.ts:101, server/src/routes/media.ts:122, server/src/routes/media.ts:148, server/src/routes/media.ts:182, server/src/routes/media.ts:226, server/src/adapter/media.ts:21

根拠（探索）: routes/media.ts(268行)は『薄い HTTP 層』のはずが、Range パース・開放端切り詰め・416・ETag/If-Modified-Since 判定・Content-Range 組み立てを自前で持つ。streamWithRange は MediaLocation の file/synthetic 分岐を『Rangeなし200』『206』で別々に書き、streamWhole と合わせて Response 組み立てが5回重複。MediaLocation の synthetic バリアント(read(start,end))は fixture のためだけに本番ルートと契約型へ入り込んでいる。size を stat した後に別 open でストリームを張るため、サイズ取得と読み出しの間でファイルが変わる余地もある。

裏取り（検証）: 事実。routes/media.ts(268行)は parseRange・開放端切り詰め・416・ETag/If-Modified-Since/etagMatches 判定を自前で持つ。MediaLocation の synthetic 分岐は sizeOf(80)、streamWhole(90)、streamWithRange の Range 無し200(173)、206(210) の4箇所で、file 分岐と並べて Response を組み立てる箇所は streamWhole 2 + streamWithRange(空・200・206 の file/synthetic) で計6〜7箇所(findingの『5回』は誤差の範囲)。synthetic バリアントは fixture 専用(adapter/media.ts:19、fixture/media.ts:28,158 のみで real は file のみ)。サイズを stat した後に別 open で createReadStream を張る(sizeOf→createReadStream)点も事実だが、読み出し範囲は start/end 明示なのでファイルが変わっても Range 外参照は起きず、影響は『壊れた/縮んだファイルでストリームが短くなる』程度。

既知との関係: TASK-340(In Progress)は開放端Rangeを上限付き206にしバックプレッシャー不全を解消する挙動修正で、まさに同じ streamWithRange を触っている。TASK-376(Done)は audio 経路制限。ADR-0019 はメディアストリーミング接続寿命。本件の『分岐重複・synthetic 混入・配信処理の lib 切り出し』は 340 の受け入れ条件外。

評価: 構造指摘としては妥当(file/synthetic の二重分岐は MediaLocation を『size と open(start,end): ReadableStream』に統一すればなくなる)。ただし TASK-340 が同じ関数を現在進行形で書き換えているため、独立タスクにするより 340 の完了後に整理するか 340 に含める方が衝突しない。fixture 都合の synthetic が本番ルートに入る点は方針(fixture は adapter 境界の外に閉じる)に照らして直す価値があるが、実害は無く保守性のみなので medium 未満の low。

探索時の提案: 配信を `lib/mediaResponse.ts`（Range/条件付きGET/ヘッダ組み立て）に切り出し、MediaLocation を『size と open(start,end): ReadableStream を持つ単一抽象』に統一する（file は createReadStream、fixture は合成ストリームをその実装として包む）。ルートは locate→サイズ判定→respond の呼び出しだけにする。

## srv-arch-7 エラー→HTTP の写像が route ごとの try/catch・lib・app.onError に分散し、コード名と意味がずれている

- 判定: partial / new / severity low
- 場所: server/src/routes/works.ts:98, server/src/routes/works.ts:221, server/src/routes/scan.ts:61, server/src/routes/scan.ts:98, server/src/routes/scan.ts:127, server/src/routes/dlsite.ts:120, server/src/routes/rootReconfiguration.ts:25, server/src/app.ts:142, server/src/errors.ts:62, server/src/lib/httpError.ts:44, server/src/routes/works.ts:213

根拠（探索）: ルート内の instanceof 判定が少なくとも8箇所、throwSourceCommandError が source 系だけ、app.onError が NotConfigured/RootReconfiguring/HTTPException だけを処理する3方式が併存。WorkRegisterError は code 5種の union を errors.ts で2回書き(コンストラクタ引数と readonly)、works.ts では code ごとに if を並べて conflict/notFound へ写す。`not_configured` は『パスが存在しない/root配下でない』にも使われ(workRegister.ts の resolve 失敗)、works.ts:104 で notFound へ写る一方、NotConfiguredError は app.onError で 409 になるため、同じ語が 404 と 409 に分かれる。DELETE /works/:id は unregisterWork が投げる MetaUnregisterError を捕捉せず 500 internal になる。

裏取り（検証）: 数と構造は概ね事実: routes 内の instanceof 判定は8箇所(scan.ts:61/98/127、works.ts:100/221、rootReconfiguration.ts:25/26、dlsite.ts:120)、throwSourceCommandError(source系3種のみ)と app.onError(NotConfigured/RootReconfiguring/HTTPException)の3方式が併存。WorkRegisterError の code union が errors.ts のフィールドとコンストラクタ引数で二重記述なのも事実。not_configured が『パス不存在/root配下でない』にも使われ works.ts:104 で 404 に写り、NotConfiguredError は 409 に写る点も事実で、同じ語が別意味・別ステータスで使われている。誤り/誇張: 『DELETE /works/:id は unregisterWork が投げる MetaUnregisterError を捕捉せず 500』は事実だが、MetaUnregisterError は『メタの退避状態が矛盾しています』『退避したメタを復元できません』といったファイルシステム上の不整合(workRegister.ts:134-154)で、ユーザー入力由来ではなく 500 internal が妥当な内部不整合。『写像漏れ』とは言いにくい。

既知との関係: TASK-380(Done)はスキャン候補409判定を型付き例外化した延長で、本件はその範囲外(候補プール以外)。TASK-399/404 等に個別のエラー写像修正はあるが、写像の一元化を扱う未完了タスク/ドラフトは見つからず。docs/client-error-handling.md はクライアント側のエラー契約。

評価: 『WorkRegisterError の not_configured をパス不正と NotConfigured で混同している』点だけは名前の誤用で、path 不正は専用コード/エラーにすべき(後方互換不要なので素直に直せる)。一方、『ドメインエラーに httpStatus を持たせる写像表の一元化』は、ルートが8箇所の instanceof を持つだけの規模では過剰気味で、エラー種別が増えてからで足りる。MetaUnregisterError を 4xx にするのは逆に不整合を隠すので不要。実害は小さく、not_configured の改名程度に絞るなら low。

探索時の提案: ドメインエラーに `httpStatus/apiCode` を持たせるか、errors.ts の写像表1つを app.onError で適用する形に統一し、route 側の try/catch を撤去する。WorkRegisterError は code を型エイリアス1つにし、path 不正は専用エラー(PathOutsideRootError 等)に分けて NotConfigured との混同を解く。MetaUnregisterError も既知エラーとして写す。

## srv-arch-8 fixture/data.ts が型・シード・FSツリー生成ロジック・スマートフォルダー生成を1ファイルに抱えている

- 判定: partial / new / severity drop
- 場所: server/src/adapters/fixture/data.ts:22, server/src/adapters/fixture/data.ts:57, server/src/adapters/fixture/data.ts:444, server/src/adapters/fixture/data.ts:478, server/src/adapters/fixture/data.ts:568, server/src/adapters/fixture/data.ts:638

根拠（探索）: data.ts(670行)は FixtureWorkRecord 等の状態型、RAW_SEED_WORKS(約260行の宣言データ)、プレイリスト/トラックのシード仕様、FsNode 型と buildWorkFileTree/buildFsRoot/ensurePath/circleFromPhysicalPath という『ロジック』、createSeedSmartFolders を同居させ、state/works/playback/fsMethods/fsResolve/coverDto/settingsScan から import される。型定義が data.ts にあるため coverDto.ts→data.ts→coverDto.ts と相互参照になっている(data.ts:48 の再export)。

裏取り（検証）: 数値は事実: data.ts は670行で、FixtureCoverColumns/FixtureWorkRecord(状態型)、RAW_SEED_WORKS(57-318付近の宣言データ)、SEED_TRACK_NAMES・SEED_PLAYLIST_SPECS(シード仕様)、FsNode と buildWorkFileTree/buildFsRoot/ensurePath/circleFromPhysicalPath(FSツリー生成ロジック)、createSeedSmartFolders を同居させる。coverDto.ts は data.ts から `import type { FixtureCoverColumns }`(型のみ)し、data.ts は `fixtureCoverFromColumns` を coverDto.ts から import して再exportする(data.ts:19,48)ので、相互参照は存在するが type-only import 側であり実行時の循環ではない。

既知との関係: TASK-395(Done)はfixtureのFilesツリーのphysicalPath由来化、TASK-383(Done)はfixture状態のスコープ化、TASK-447.27(Done)はfixture経緯コメント削除。fixture/data.ts の分割を扱うタスクは無し。

評価: fixture はテスト・開発用の内部資材で、670行1ファイルが運用上の障害になっているエビデンスがない。型循環は type-only で実行時問題なし。『シナリオ追加時に判断しづらい』は主観的。分割しても得られるのは見通しのみで、実害のない整理は方針上の優先度が低い。放置で良い。

探索時の提案: fixture/types.ts(状態型)、fixture/seed/works.ts・playlists.ts(宣言データ)、fixture/fsTree.ts(FsNode と生成ロジック)に分割し、coverDto は types だけに依存させる。

## srv-data-1 派生キャッシュ（DLsiteキャッシュ・カバー・probe・tags）に寿命管理がなく、削除経路も手動CLIのみ

- 判定: partial / new / severity low
- 場所: server/src/adapters/real/dlsiteCache.ts:195, server/src/adapters/real/dlsiteCache.ts:433, server/src/dlsiteCacheCli.ts:201, server/src/adapters/real/catalogSchema.ts:138, server/src/adapters/real/catalogWorkRepository.ts:129

根拠（探索）: cleanupExpired() の呼び出し元は dlsiteCacheCli.ts:201 の手動コマンドだけで、サーバー内の自動実行はない。しかも対象は dlsite_html_snapshots と dlsite_fetch_failures のみで、dlsite_cover_entries（BLOB本体）はTTLもGCもなく putCover の上書きだけで増える。catalogのaudio_probe_cacheも削除経路がなく、作品の登録解除・root外削除でpathが残り続ける。deleteWorkRows は work_tags/work_dlsite/works しか消さず、どの作品にも紐づかない tags 行が残る。ADR-0008が決めたのは配置だけで、各キャッシュの寿命の規則は文書にも実装にもない。

裏取り（検証）: cleanupExpired の呼び出し元は dlsiteCacheCli.ts:201 のみ（確認）。cleanupExpired は snapshots と failures だけ消し、dlsite_cover_entries は TTL もGCもなく putCover の ON CONFLICT 上書きのみ（確認）。audio_probe_cache は probe.ts の読み書きだけで削除経路なし、tags 行の削除経路もなし（確認）。ただし docs/dlsite.md:152,202 がcleanupを手動CLI運用として明記しており、「ADRに寿命規則がない」は半分誤り：ADR-0008 の表は audio_probe_cache を『再プローブで回復する派生キャッシュ』と分類している。HTML snapshotはアーカイブ出力にも使われTTL切れ行も対象（docs/dlsite.md:187）なので、自動cleanupは意図的な手動運用と衝突する。カバーはURLキーで作品あたり1件程度で『無制限に増える』は誇張。tagsは辞書行でノイズ程度。

既知との関係: TASK-100（HTML実サイズ計測）、TASK-389（Done, 配置記述）は寿命管理を扱わない。cleanup/寿命/probe cacheの検索で該当する未完了・ドラフトタスクなし。ADR-0008:50 は寿命の異なる値を未分類で追加しない旨のみ。

評価: 事実は概ね正しいが実害が薄い。個人ローカルアプリでキャッシュ肥大は status().bytes で観測でき、cleanupは文書化済みの手動運用。coverにTTL導入やfinalizeScanでの自動GCは、アーカイブ出力の前提を崩すか過剰設計になりうる。妥当なのは『audio_probe_cacheの孤児（登録解除・root外削除後のpath）とtags孤児をfinalizeScanで掃除する』程度の小さな整理で、これも優先度は低い。『寿命規則をADR-0008へ追記』は文書整理として軽く価値あり。

探索時の提案: 派生キャッシュごとに「誰が・いつ・何を基準に消すか」を1か所（ADR-0008追記）で決める。DLsiteキャッシュはcoverにもTTLを持たせ、cleanupExpiredをサーバー起動時またはfinalizeScanで自動実行する。audio_probe_cacheとtagsの孤児は finalizeScan で作品参照に基づき一括GCする（サムネイルGCと同じ扱いに揃える）。

## srv-data-2 スキーマバージョン定数が手書きで、マイグレーション数・user_versionと3重に食い違う

- 判定: confirmed / extends-known / severity medium
- 場所: server/src/adapters/real/db.ts:22, server/src/adapters/real/db.ts:23, server/src/adapters/real/sqliteMigrationExecutor.ts:101, server/src/adapters/real/sqliteMigrationExecutor.ts:141

根拠（探索）: drizzle/catalog には 0000〜0012 の13本、drizzle/user には 0000〜0006 の7本があるのに、CATALOG_SCHEMA_VERSION=9、USER_SCHEMA_VERSION=8 が手書き定数になっている（数が合わない）。applyMigrationAtomically は各migrationのたびに PRAGMA user_version = <定数> を書く。pending判定は __drizzle_migrations の最大 created_at との大小比較のみで、journalにあるhashの集合照合ではない。assertDatabaseNotNewerThanApp の「アプリより新しい」判定は user_version > 定数 と、journalに無くかつ最大より新しい created_at の2系統に分かれている。

裏取り（検証）: drizzle journal は catalog 13本・user 7本（jqで確認）に対し、db.ts:22-23 は CATALOG_SCHEMA_VERSION=9、USER_SCHEMA_VERSION=8 の手書き定数で数が合わない（確認）。executeSqliteMigrations/applyMigrationAtomically は各migrationごとに PRAGMA user_version = 定数 を書く（確認）。pending判定は latestMigrationTime（created_at最大値）との大小比較、assertDatabaseNotNewerThanApp は user_version>定数 と『journalに無く最大より新しいcreated_at』の2系統（確認）。user_version は適用数でもスキーマ世代でもない値になっている。

既知との関係: TASK-356（Done, in-place適用への簡素化）とADR-0023がこの機構を導入した側。定数や user_version の廃止・導出を扱うタスクはなし（user_version / schema version 検索で該当なし）。

評価: 妥当。手書き定数がfail-fastの足場になっているのに更新漏れを検出できず、journal件数とも既に乖離している。user_versionをjournal由来にする、またはhash集合照合に一本化する案は長期的に正しく、後方互換不要の方針とも整合する。ただし『順序前後のmigrationが黙ってスキップ』は単一開発者がdrizzle-kitで生成する運用では起きにくく、実害は定数のずれによるfail-fastの形骸化が中心。severityはmedium止まり。

探索時の提案: user_versionをjournalのエントリ数から導出し、手書き定数を廃止する。pending判定は適用済みhashの集合とjournalのhashを照合する形にする。『DBがアプリより新しい』判定もこの集合比較に一本化する。

## srv-data-3 catalogのDLsite状態が meta・キャッシュ・時刻の3入力から作られるのに、増分scanのrevisionは meta だけしか見ない

- 判定: refuted / duplicate / severity drop
- 場所: server/src/adapters/real/fingerprint.ts:34, server/src/adapters/real/scanRegister.ts:128, server/src/adapters/real/dlsiteProjection.ts:11, shared/src/dlsite.ts:120, server/src/adapters/real/scanTypes.ts:72

根拠（探索）: computeProjectionRevision が dlsite について見るのは rjCode と appliedTags だけ。一方 assembleWorkForUpsert は resolveMetaDlsiteProjection(meta.dlsite, dlsiteCache) で cache.resolve() の結果（失敗記録のTTL切れで error から none へ変わる、など時刻依存）を work_dlsite.state_json へ書く。canSkipIncremental が true になると再投影されないので、キャッシュ側の変化（TTL切れ・別経路での取得）は fetch 直後の refreshWorkDlsiteProjection でしかcatalogへ届かない。

裏取り（検証）: コード上の事実（computeProjectionRevision が dlsite は rjCode と appliedTags しか見ない、assembleWorkForUpsert が cache.resolve を合成して state_json へ書く、canSkipIncremental が再投影を飛ばす）は正しい。しかしこれは設計判断済み：ADR-0017:59 が『失敗記録のTTLは再取得の可否だけを制御し、catalog投影の表示は制御しない。TTL切れでも最後の取得結果を保持。期限切れの失敗投影は次回の一括取得で自己修復する。ゆえに canSkipIncremental に再投影処理を追加しない』と、まさにこの提案を名指しで却下している。ADR-0023:112-125（TASK-460）も、失敗表示は一時的な観測でcatalog再構築後の保持を保証せず、TTLと表示の寿命は別と明記。『古いまま残る』は不具合ではなく仕様。

既知との関係: TASK-460（Done）とADR-0017:59 / ADR-0023:112-125 が完全にカバー。TASK-468（Done）はmeta型とAPI型の分離で別側面。

評価: 既存ADRが理由付きで却下済みの案の再提案。『読み取り時に合成して永続化しない』という別案は設計としてあり得るが、一覧のソート・絞り込みをSQLで行うADR-0008の構成（全件をcatalogから読む）と衝突しやすく、実害もない。対応不要。

探索時の提案: DLsite状態を work_dlsite へ永続投影するのをやめ、読み取り時に meta 由来の状態と cache.resolve を合成する（時刻依存の値を永続化しない）。永続化を続けるなら、cache側の世代（resolutionの種別と期限）を projectionRevision の入力に含める。どちらかに決めてADRへ書く。

## srv-data-4 root外作品の削除がuser状態を消さず、catalog/user間の孤児を検出・回収する経路がない

- 判定: refuted / duplicate / severity drop
- 場所: server/src/adapters/real/catalogWorkRepository.ts:147, server/src/adapters/real/settingsScanMethods.ts:186, server/src/adapters/real/workRegister.ts:184, server/src/adapters/real/db.ts:196

根拠（探索）: unregisterWork は catalog.deleteWorkCatalog のあとに user.deleteWorkUserState を呼ぶ。deleteWorksOutsideRoot（rebuildCatalogForRoot から呼ぶ）は catalog 行だけを消し、user.sqlite の work_states（ブックマーク・レジューム・追加日時）を消さない。openDb が検証するのは『catalogにあってuserに無い』方向だけで、『userにあってcatalogに無い』は検査も回収もされない。2つのDBは別ファイルで、書き込みは user→catalog、削除は catalog→user と順序が異なるトランザクションを別々に張っている。

裏取り（検証）: コード上の観察は正しい：deleteWorksOutsideRoot は deleteWorkRows のみで user.work_states を消さず、unregisterWork は user 側も消す。openDb が検証するのは『catalogにあってuserに無い』方向のみ（db.ts:193付近で確認）。しかし『意図か事故か文書から判別できない』は誤り：ADR-0008:71 が『user DBはcatalogへの外部キーを持たず、ON DELETE CASCADEも使わない。catalogが消えてもuser状態は孤児として残し、同じWork UUIDが再び現れたら再接続する』と明記し、ADR-0008:111 とADR-0023:108 も孤児行の保持・自動削除しない方針を述べている。

既知との関係: ADR-0008:71, ADR-0023:108 が仕様として決定済み。TASK-463（user DB単独復元手順）とTASK-471（登録解除時のID重複診断）は別側面。

評価: 既に意図的な非対称設計として記録されている。root変更を繰り返しても孤児は作品数に比例する小さな行でしかなく、同IDが戻れば復活するのが望ましい挙動。finalizeScanでの整合チェックやログは過剰。対応不要。唯一、unregister（明示削除でuserも消す）とroot外削除（保持）の差をADR-0029等に1行足す程度は任意。

探索時の提案: user状態の寿命を決める。『rootから外れた作品の状態は保持し、同じIDで戻れば復活させる』のなら、その仕様をADR-0029へ書き、登録解除（明示削除）との差を明記する。そうでないなら deleteWorksOutsideRoot で user 側も消す。いずれの場合も、finalizeScan に catalog に存在しない user.work_states の整合チェック（件数ログか回収）を置く。

## srv-data-5 メタファイルの読み込み・パース・候補ID抽出が複数箇所で重複し、scan中に同じファイルを3回読む

- 判定: partial / new / severity medium
- 場所: server/src/adapters/real/meta.ts:62, server/src/adapters/real/meta.ts:100, server/src/adapters/real/scanRegister.ts:127, server/src/adapters/real/scanner.ts:96, server/src/adapters/real/scanMetaStagingRecovery.ts:14, server/src/adapters/real/scanUpsertBatch.ts:43

根拠（探索）: JSON.parse と MetaParseError 生成が meta.ts の readMetaSource、scanRegister.prepareMetaEntries（同一コンテンツを無名関数で2回パース、candidateId抽出も内側で再実装、さらに正規表現版の extractCandidateIdFromMetaContent）、scanner.findIdentityConflicts、scanMetaStagingRecovery.readStagedMetaWorkId に独立して存在する。parseMetaRaw は meta.ts に非公開で、scanRegister は metaFileSchema.safeParse を直接呼ぶ。フルscanでは findIdentityConflicts（全meta読み込み）、prepareMetaEntries（全meta読み込み）、discardChangedSources（全meta再読み込み）で同じファイルを最低3回読む。prepareMetaEntries の _root と _seenIds は未使用の引数。

裏取り（検証）: 重複は実在：prepareMetaEntries（scanRegister.ts:180-）は同一 content を無名関数で2回 JSON.parse し、candidateId 抽出を3通り（正規表現版 extractCandidateIdFromMetaContent、内側のinline、safeParse失敗側のinline）で持つ。_root と _seenIds は未使用引数（確認）。meta.ts の parseMetaRaw は非公開で、scanRegister は metaFileSchema.safeParse を直呼びし formatVersion 判定を通らない（確認）。findIdentityConflicts（scanner.ts:84）、scanMetaStagingRecovery、readMetaSource も独自に JSON.parse する。『フルscanで3回読む』は誇張気味：findIdentityConflicts と prepareMetaEntries の2回は実際に重複読み込みだが、discardChangedSources の再読み込みは staging 後に外部編集されていないかを確かめる意図的な再検証（TOCTOU対策）で、重複ではない。MetaParseError の kind が scanRegister 側で既定になる件は未確認の細部。

既知との関係: TASK-419（CASレース, Done）・TASK-448.4（finalize経路）とは別側面。読み込み・パース経路の重複を扱うタスクは検索で見つからず。

評価: 提案の核（readMetaSource を唯一の入口にし、scanは1ファイル1回の読み込みから id・診断・投影入力を取り出す）は妥当で、後方互換不要の方針にも合う。特に同一contentの二重パース、正規表現版の候補ID抽出、未使用引数、formatVersion判定のずれは確実な負債。ただし再検証用の読み込みは残すべきで、『I/O3倍』は誇張。identity_conflict を prepare 結果のIDで判定する案は、不正JSONでも candidateId を拾う現挙動との整合を設計時に確認する必要がある。

探索時の提案: readMetaSource（bytes + raw + parsed）を唯一の入口にし、scan は1ファイル1回の読み込みから id・診断・投影入力を取り出す PreparedMeta 構造を作る。identity_conflict 判定は prepare 結果のIDで行い、生ファイルの再読み込みと正規表現抽出を廃止する。

## srv-data-6 Scannerがフルscan・単作品登録・復元を1クラスに抱え、登録系4メソッドがほぼ複製

- 判定: partial / extends-known / severity low
- 場所: server/src/adapters/real/scanner.ts:419, server/src/adapters/real/scanner.ts:460, server/src/adapters/real/scanner.ts:515, server/src/adapters/real/scanner.ts:556, server/src/adapters/real/scanUpsertBatch.ts:62, server/src/adapters/real/scanUpsertBatch.ts:84

根拠（探索）: Scanner（665行）には scan() のほか、registerFolderWork/registerFileWork/restoreFolderWork/restoreSidecarWork/projectMetaFile がある。patch の型 {title,tags,urls,coverImage,dlsite} が4か所にインライン展開され、フォルダー版とサイドカー版でRJコード検出・metaPath算出・既存チェックが分岐して重複している。rjCode を受け取る registerFolderWork と受け取らない registerFileWork で入力の契約もずれている。ScanUpsertBatch の publishWork と publishScanGeneration も、userTransaction とcatalog transactionの本体がほぼ同一のコピー。

裏取り（検証）: Scanner は665行で registerFolderWork / projectMetaFile / restoreFolderWork / registerFileWork / restoreSidecarWork を持つ（確認）。『登録系4メソッド』は実際は register×2 + restore×2 + projectMetaFile で、patch型 {title,tags,urls,coverImage,dlsite} のインライン展開は4か所＋metaPatch で確認。rjCode を受けるのは registerFolderWork のみで契約のずれも実在。ただしフォルダー版とサイドカー版の差（RJ検出元・metaPath算出・tracks有無）は配置形式に由来する本質的な差で、『ほぼ複製』は誇張。ADR-0032 により各メソッドは最終的に prepareSingleMeta → registerSingleWorkFromPrepared の共通経路へ合流済み。ScanUpsertBatch の publishWork と publishScanGeneration は upsert/error ループが同一で、後者は replaceIdentityConflicts と markMissingExcept が加わる（部分的にコピー）。

既知との関係: TASK-388（Done）はscan実行と候補プール分離で別側面。TASK-467（Done）が配置の確定を後段へ持ち込まない整理を完了済み。TASK-423（単一ファイル手動登録）は未着手と思われるが、本所見の根拠はそこ。

評価: patch型の共有（MetaPatch型の切り出し）と publish の共通private化は小さく妥当な整理。一方 WorkRegistrar への分割は、配置別の分岐が減るわけではなく、TASK-423 が始まってから必要な形を見て決めるべきで、先行の一般化は過剰設計。TASK-423 着手時にまとめて対応するのが良い。

探索時の提案: 単作品の登録・復元・投影を WorkPlacement（metaPath から解決）を引数にとる1つの WorkRegistrar へ切り出し、scan() 本体は Scanner に残す。patch は MetaPatch 型を共有する。ScanUpsertBatch は publish の共通部分を1つの private メソッドにまとめる。

## srv-data-7 mimimilli.json書き込みロックが同期スピン待ちとlockファイルのstale奪取に依存

- 判定: partial / extends-known / severity low
- 場所: server/src/adapters/real/meta.ts:116, server/src/adapters/real/meta.ts:120, server/src/adapters/real/meta.ts:135

根拠（探索）: withMetaPathLock は競合時に Atomics.wait で最大5秒メインスレッドを同期的に止める。10秒を超えた lock は mtime だけで unlink して奪い、奪った直後にもう一方が openSync で再作成したlockを、別のプロセスが stat/unlink する窓は塞がれていない。lock・tmp・rollback・.unregistering のドットファイルがユーザーのライブラリに作られ、scan側の walk と recovery がそれらを知っている必要がある。

裏取り（検証）: meta.ts:116-170 の withMetaPathLock は競合時に Atomics.wait(10ms刻み、最大5秒)で同期待機し、10秒超のlockを mtime だけで unlink して奪取する（確認）。lock取得後にstale判定した別プロセスとの窓は理論上あるが、保持時間はミリ秒オーダー。ロックはまさに TASK-419 で実測したレース（worker とメインスレッドの並行書き込み、Worker 2本で lostUpdate 116/200）を塞ぐために入れたもので、『プロセス内Mutexで足りる』は不正確：scan workerは別スレッドなので、メインスレッドのMutexでは直列化できず、ファイルロックまたは SharedArrayBuffer 共有が必要。Atomics.wait は worker では許容されるがメインスレッドでは5秒ブロックの可能性は事実。

既知との関係: TASK-419（Done）がロック導入とstale lock回復を実装した。イベントループ停止という側面は未カバーだが、通常はミリ秒保持でありTASK-419の実測でも問題として挙がっていない。

評価: 提案は前提（単一プロセス内の直列化で足りる）がscan workerの存在を見落としており、そのままでは TASK-419 で直したレースが再発する。実害（クラウド同期フォルダー上での長時間fsyncでのブロック）も未観測。複数プロセス要件のADR確定という提案は将来構想のための一般化にあたり価値が薄い。対応不要か、実害が観測された時点で検討。

探索時の提案: ロックの目的を『単一サーバープロセス内の直列化』に限定し、プロセス内のpath別Mutexへ置き換える。別プロセスの外部編集との整合はsourceRevisionのCAS（既存）に任せ、lockファイルとstale奪取を廃止する。複数プロセスから書く要件が本当にあるかを先にADRで確定する。

## shared-1 ビュー・軸・スマートフォルダーのID名前空間が文字列で、予約語リストが3箇所に複製されている

- 判定: confirmed / new / severity medium
- 場所: shared/src/library.ts:34, shared/src/library.ts:41, shared/src/tagPrefix.ts:7, client/src/entities/library/axisDefinitions.ts:12, client/src/entities/library/axisDefinitions.ts:36, server/src/routes/axes.ts:13

根拠（探索）: viewIdSchema の enum([all,recent,added,fav,error])、tagPrefix.ts の RESERVED_AXIS_IDS（同じ5つ+tag/year）、client axisDefinitions.ts の VIEW_AXIS_IDS が手書きで並存している。facetAxisIdSchema は trim+小文字化+スラッシュ禁止だけで予約IDを検査せず、GET /axes/:axis は all や smart-x も軸IDとして受理する。軸種別の判定は isFacetAxis が !isViewAxis && !=='tag' && !startsWith('smart-') という否定の連鎖で行っている。「smart-」接頭辞の禁止もtagPrefixNameSchemaとclientの2箇所に別々に書かれている。

裏取り（検証）: 事実はほぼ正しい。viewIdSchema(library.ts:34)、RESERVED_AXIS_IDS(tagPrefix.ts:7、ビュー5つ+tag/year)、client VIEW_AXIS_IDS(axisDefinitions.ts:12)が手書きで3系統並存。facetAxisIdSchema は予約IDを検査せず GET /axes/:axis は all や smart-x も通す(ただし結果は空の prefix 集計になるだけで実害は薄い)。isFacetAxis は否定連鎖。smart- 禁止は tagPrefixNameSchema と client の startsWith/navigationUrl.ts にも散在。『ビューを足すと3箇所同期』は正しいが、予約語の取り違えが静かに起きる、という実害は限定的。

既知との関係: DRAFT-50(ビュー軸とスマートフォルダー評価経路の統合)、ADR-0016(ビュー5つの確定)と近接するが、ID名前空間と予約語の重複は未カバー。TASK-428.22 は識別情報(ラベル)の話で別。

評価: 重複の解消自体は妥当。ただし提案の判別共用体(kind付きの軸ID型+パーサ)は大改造で、URL・状態・API全域に波及しやや過剰。まず shared に VIEW_IDS を一本化し、RESERVED_AXIS_IDS=[...viewIdSchema.options,'tag','year'] と client の VIEW_AXIS_IDS を導出に置き換える、smart- 接頭辞の判定も shared の1関数にする、で目的は達成できる。パーサ型化は DRAFT-50 の結論後に検討。

探索時の提案: 軸IDをsharedで `{kind:'view',id:ViewId} | {kind:'builtin',id:'tag'|'year'} | {kind:'prefix',prefix} | {kind:'smart-folder',id}` のような判別可能な型（またはパース関数）として一度だけ定義し、予約語はVIEW_IDS・BUILTIN_AXIS_IDSからの導出にする。RESERVED_AXIS_IDS・VIEW_AXIS_IDS・isFacetAxis等は廃止してパーサ経由に統一する。

## shared-2 タグ唯一属性（ADR-0005）に反し、特定prefixの意味がコードにハードコードされ、prefix設定データで表現できていない

- 判定: partial / duplicate / severity drop
- 場所: shared/src/work.ts:229, shared/src/dlsite.ts:268, shared/src/dlsite.ts:293, shared/src/tagPrefix.ts:25, shared/src/tagPrefix.ts:88

根拠（探索）: ADR-0005 決定3は「コードに特定prefixの分岐を書かない。特別扱いは編集可能なprefix定義で表現する」とする。しかし extractCircleName は CIRCLE_TAG_PREFIXES=['サークル/','circle/'] を直書きし（ADR決定5がエイリアス解決をしないと決めた 'circle' まで特別扱い）、DLSITE_TAG_FIELDS は prefix名 サークル/cv/genre/rating と single/multi の濃度(cardinality)を定数で持つ。単一値かどうかは tagPrefixSchema（label/color/showAsAxis/protected/order）に存在せず、ユーザーが prefix を削除・改名してもDLsite適用・一覧のcircleName列は固定名で動き続ける。TAG_PREFIX_COLOR_KEYS も cv/circle/series/cat の固定enumで、ユーザー定義prefixは色キーがこの4値に限られる。

裏取り（検証）: コード上の事実(extractCircleName が ['サークル/','circle/'] 直書き、DLSITE_TAG_FIELDS が prefix 名と cardinality を持つ、TAG_PREFIX_COLOR_KEYS が4値固定)は正しい。しかし ADR-0005 決定1は『dlsite.ts の中間表現は例外で、apply 時にタグへ変換して合流させる』と明記しており、DLSITE_TAG_FIELDS のコメントも『prefix 分岐はここに一度だけ』と意図を書いている。つまり『ADR違反』は誇張。'circle/' を拾うのは決定5(エイリアス解決しない)との小さな不整合として実在する。

既知との関係: TASK-378(Done)が『tag_prefixes 設定から代表 prefix を選ぶ汎用機構化は行わない(仕様が曖昧になる、タグ横断リネーム設計時に再検討)』と明示的に却下済み。TASK-447.26 も関連。

評価: 提案の role/cardinality をprefix定義に持たせる案は、TASK-378 で却下済みの汎用化そのもので、将来構想のための一般化に当たり過剰設計。唯一拾う価値があるのは 'circle/' の特別扱いを外して『サークル』単一にする程度の小修正(実害ほぼ無し)で、タスク化するほどではない。

探索時の提案: tagPrefixSchema に cardinality('single'|'multi') と、サークル名のような意味的ロール（例: role:'circle'）またはDLsite取り込み先の宣言を持たせ、extractCircleName・fillUnset/mergeAppliedDlsiteTags・DLSITE_TAG_FIELDS は設定されたprefix定義を引数に受ける形へ変える。コード内のprefix名リテラルは DEFAULT_TAG_PREFIXES（初期投入）だけに閉じ込める。

## shared-3 スマートフォルダー条件の表現が弱く、不変条件が型でなく評価時の例外・慣習に置かれている

- 判定: partial / extends-known / severity low
- 場所: shared/src/library.ts:62, shared/src/library.ts:91, server/src/core/smartFolder.ts:20, server/src/core/smartFolder.ts:34, server/src/core/smartFolder.ts:61

根拠（探索）: smartFolderRuleSchema は日本語リテラル(field:'タグ'/'長さ', operator:'∋'/'≥')を判別子にしてuser DBへJSON保存する。『長さ』の値は values: z.array(z.string().regex(/^\d+$/)).length(1) という数値の文字列配列で、評価側が parseSmartFolderMinLengthSec(rule.values[0]) で再度Number変換し、不正なら例外を投げる。さらに共有スキーマが許可済みの値に対して evaluator に default: throw が残る。conjunction はルールを左から畳み込むだけで優先順位・グルーピングがなく、先頭ルールがWHEREであること・2件目以降がWHEREでないことはスキーマで検査されず(index===0 || conjunction==='WHERE' で黙って結果を置換する)、AND NOT は『長さ』には型で不可だが「タグ」にWHERE以外の先頭が来ても通る。smartFolderUpdateSchemaのrefineにはメッセージもない。

裏取り（検証）: スキーマ(library.ts:62-)は日本語リテラル判別子、『長さ』values は数値文字列配列で、評価側が parseSmartFolderMinLengthSec で再 Number 変換し default: throw も実在(smartFolder.ts)。WHERE が途中に来ると結果を置換する挙動(index===0||WHERE)も事実。smartFolderUpdateSchema の refine にメッセージ無しも事実。ただし UI が先頭だけ WHERE を作る前提で通常は発生せず、default throw は discriminatedUnion 後の網羅ガードで実害無し。『長さ』の値を数値型でなく文字列にしている点は確かに不自然。

既知との関係: DRAFT-36/37(条件フィールド拡充、Draft)は機能追加側。TASK-428.11(Done)は検証・表示文言の統一で、型表現の側面は未カバー。DRAFT-50 は評価経路の統合で別軸。

評価: 長さ値の number 化・先頭 WHERE 不変条件のスキーマ化は、DRAFT-36/37 で条件フィールドを増やす時に同時にやるのが筋(永続形式を壊すのでその時点でADRに手動移行手順を残す)。今単独でやる価値は低く、ルール木化は過剰。DRAFT-36/37 の前提メモとして残す扱いが妥当。

探索時の提案: ルールを内部表現として型付きにする（例: {type:'tag-any',tags}/{type:'min-duration',seconds:number}）。結合は先頭だけ特別扱いする代わりに『先頭条件 + (op, 条件)[]』の構造にするか、ルール木にしてスキーマレベルで先頭のWHEREを不要にする。評価の default throw や数値再パースは型で消す。永続形式の変更は手動マイグレーションをADRに残す方針で破壊的に行う。

## shared-4 エラー契約がコード1個+messageのみで、種別の重複と型付きでない付随情報・SSEエラーの非統一がある

- 判定: partial / extends-known / severity low
- 場所: shared/src/api.ts:352, shared/src/dlsite.ts:16, shared/src/scan.ts:157, shared/src/scan.ts:139, shared/src/dlsite.ts:565, shared/src/rootReconfiguration.ts:26, server/src/lib/httpError.ts:8, server/src/app.ts:139

根拠（探索）: apiErrorSchema.code は9値で、HTTPの意味(not_found/invalid_request/internal)とDLsite取得の分類(parse_error/offline/error)と状態競合(conflict/source_changed/root_reconfiguring)が同じenumに混在する。dlsiteFetchErrorKindSchema([not_found,parse_error,offline,error])はこのうち4値をコピーした別enum。ステータスマッピングはhttpError.ts STATUS_BY_CODEとapi.tsのコメントの2箇所。'error'(502)と'internal'(500)の使い分けが契約上不明。scan 409は scanConflictResponseSchema（code:'conflict'+active）という別形式でapiErrorSchemaに乗らず、client/features/scan/api.ts が専用にsafeParseする。ジョブ系の失敗は ScanJobSnapshot.error:string / scan 'failed' {error:string} / DLsite 'error' {message} / rootReconfiguration failed {message} とフィールド名も形も揃っていない。

裏取り（検証）: apiErrorSchema は9コードで HTTP 意味と DLsite 分類と競合が同居、dlsiteFetchErrorKindSchema は4値のコピー、STATUS_BY_CODE(httpError.ts:8)とapi.tsコメントの2箇所、scanConflictResponseSchema は別形式で client/features/scan/api.ts が専用 safeParse、ジョブ失敗の形(ScanJob.error:string / failed{error} / DLsite {message})も不揃い、いずれも事実。ただし 'error'(502) と 'internal'(500) の区別は httpError の用途で自明、実際に追加情報付きの応答は scan 409 の1件のみ。

既知との関係: ADR-0015(client 側の握りつぶし契約のみ)、TASK-380(Done、server 内部の型付き例外。『全API共通のドメイン理由 enum は過剰』と明示的に見送り)、TASK-470(SSE 現在状態同期、Done)。wire 契約統一は未カバーだが TASK-380 の方針と緊張する。

評価: details 付き判別共用体は、型付き付随情報が必要な箇所が1つしか無い現状では将来構想の一般化で過剰。実害のある小さな塊だけ拾うのが妥当: dlsiteFetchErrorKindSchema を apiErrorSchema の code から導出する(重複enum解消)程度。ジョブ失敗の {code,message} 統一は3つ目のジョブ追加時(DRAFT-71)に判断で十分。

探索時の提案: apiErrorSchema を判別可能unionにして `code` ごとに任意の型付きdetails（例: conflict→{active job}、source_changed→{currentRevision}）を持たせ、DLsite取得エラー種別はこのコードのサブセットとして導出する。ジョブ失敗のpayloadも同じ {code,message} 形に統一し、ステータス対応はsharedのテーブルを1箇所の正にする。

## shared-5 ScanResultが実行ごとの集計と永続的なライブラリ診断・候補プールを一つに抱え、診断の取得経路が二重化している

- 判定: partial / extends-known / severity medium
- 場所: shared/src/scan.ts:75, shared/src/scan.ts:95, shared/src/scan.ts:104, shared/src/scan.ts:111, client/src/app/ui/NotificationBell.tsx:63, client/src/features/scan/ui/ScanModal.tsx:94, client/src/features/scan/model/useScanCandidatesCache.ts:15

根拠（探索）: scanResultSchema は今回の実行カウンタ(registered/skipped/errors…)に加えて、ライブラリ全体を数える rjCodeMissingCount、dataIntegrityWarning、identityConflicts、invalidMetaFiles、candidates(未登録候補の全リスト)を持つ。この結果は ScanJobSnapshot.result、SSEのstate/completedイベント、GET /scan/last のすべてに丸ごと載る。一方 clientは identityConflicts を別エンドポイント GET diagnostics(scanDiagnosticsResponseSchema)から、invalidMetaFiles は scanResult から、候補は GET candidates とresult.candidatesの両方から取得しており、同種の「要対応」データが経路ごとに異なるソースを持つ。optionalな unreadablePaths と必須配列が混在し(unreadablePaths?:string[])、ScanDiagnostic型は scanResultSchema.shape.identityConflicts.element の逆引きで導出している。

裏取り（検証）: scanResultSchema(scan.ts:75-)が実行カウンタに加え rjCodeMissingCount・identityConflicts・invalidMetaFiles・candidates を持つのは事実で、それが ScanJobSnapshot.result・SSE state/completed・GET /scan/last に載るのも事実。client は identityConflicts を GET /scan/diagnostics から(NotificationBell.tsx:63, ScanModal.tsx:94)、invalidMetaFiles を scanResult から、候補を GET candidates と result.candidates(useScanCandidatesCache.ts:15)から取り、ソースが混在している点も正しい。ScanDiagnostic が shape.identityConflicts.element 逆引きなのも事実。『数千候補が SSE state ごとに流れる』はペイロード実測が無く誇張の可能性、ローカルアプリで実害は小さい。

既知との関係: TASK-471(Done、登録解除時の診断更新)、TASK-470/470.1/470.2(Done、SSE を現在状態同期へ)、TASK-428.19、TASK-397 が個別症状に対応済み。責務分離そのものは未カバー。

評価: identityConflicts を diagnostics API と result の二重に持ち、invalidMetaFiles だけ result 経由という非対称は実際に古くなるスナップショットの温床で、診断=現在状態リソース、ScanResult=実行サマリーという分離は長期的に正しい方向。破壊的変更OK方針とも合う。ただし candidates まで移すかは既に GET candidates があるので、result からの重複削除に留めて範囲を絞るのがよい。

探索時の提案: ScanResultを実行サマリー(カウンタ+warning)に限定し、identityConflicts・invalidMetaFiles・候補は『現在のライブラリ診断』として別リソース（またはその単一スナップショットAPI）へ移す。clientの要対応表示は診断リソース1本だけを購読する。

## shared-6 shared/dlsite.ts がAPI契約・取得キャッシュ合成・タグ変換・パッチ組立・UI表示判定を一手に抱え重複も残る

- 判定: partial / extends-known / severity medium
- 場所: shared/src/dlsite.ts:84, shared/src/dlsite.ts:268, shared/src/dlsite.ts:322, shared/src/dlsite.ts:341, shared/src/dlsite.ts:380, shared/src/dlsite.ts:224, shared/src/dlsite.ts:11

根拠（探索）: 609行のファイルに、Zod契約、projectDlsiteState(キャッシュ×正本の合成、エラーメッセージ文言生成まで)、DLSITE_TAG_FIELDS/fillUnset/mergeApplied、buildDlsiteApplyPatchとbuildDlsiteMissingApplyPatch、dlsiteLinkDisplayStatus/isDlsiteLinkFailedなどのUI表示用述語、bulkジョブSSEスキーマが同居する。buildDlsiteApplyPatch(380行〜)とbuildDlsiteMissingApplyPatch(341行〜)は『dlsite.comのURLを除いて{label:DLsite,url}を追加』『appliedTagsをdedupeで加算』『status:applied』の組み立てが丸ごと複製され、dlsite.com判定は entry.url.includes('dlsite.com') という部分一致が3箇所に直書きされている(別ドメイン文字列のURLも誤一致する)。type importで work.ts↔dlsite.ts が循環し、computeMissingDiff が WorkSummary 全体型に依存している。

裏取り（検証）: 609行(wc確認)、buildDlsiteApplyPatch と buildDlsiteMissingApplyPatch の urls 組み立て(dlsite.com を除いて {label:'DLsite',url} 追加)と linkage の status:applied/appliedTags 構築が複製されているのは事実。entry.url.includes('dlsite.com') は dlsite.ts:332/354/392 の3箇所で事実(hostname 比較でなく部分一致)。ただし work.ts↔dlsite.ts の循環は dlsite 側が type import のみで実行時循環ではなく無害。computeMissingDiff が WorkSummary 全体に依存というのは Pick で済む点は事実。『UI述語・キャッシュ合成が同居』は事実だが shared に置く理由(両 adapter と client 共有)はある。

既知との関係: TASK-468(Done、DLsite meta 専用型と API 合成型の分離、ADR-0027)と TASK-447.26(Done、欠落差分計算の shared 一本化)が一部該当。パッチビルダーの重複、URL 部分一致、ファイル分割は未カバー。

評価: 2つのパッチビルダーの共通化とDLsite URL判定の hostname 化は実害(適用ルール変更時の食い違い)があり妥当。ファイル分割(contract/domain/ui述語)も、609行で責務混在なので妥当だが優先度は下。循環import は type-only なので論点から外す。まず重複パッチ組み立て+URL判定を1関数に寄せるタスクが適切。

探索時の提案: 契約(スキーマ)、domain(tag mapping・apply patch・差分計算)、cache合成(projectDlsiteState)、UI用述語を別モジュールに分割する。URL操作は1つの関数(DLsite URLの判定はhostname比較)に集約し、2つのパッチビルダーは共通の差分→パッチ関数に統合する。WorkSummary依存はPick型に置き換えてwork.tsとの循環を断つ。

## shared-7 Work/WorkSummary/WorkListItem/WorkEditSnapshotの変換がclient手書きで、デフォルトプレイリスト解決が2系統ある

- 判定: partial / new / severity low
- 場所: shared/src/work.ts:112, shared/src/work.ts:371, shared/src/work.ts:206, shared/src/work.ts:267, shared/src/api.ts:171, client/src/features/library/ui/WorkDetailPage.tsx:77, client/src/features/library/model/useLibraryPreviewActions.ts:46

根拠（探索）: workSchemaは workSummarySchema.omit({trackCount}) に詳細フィールドを足した型で、一覧再生・プレビュー用にclientが toWorkListItem({...work, trackCount: getDefaultPlaylistTrackCount(work)}, rootFolder) と、Work から WorkSummary 互換オブジェクトを手でspreadして作っている。デフォルトプレイリスト解決は selectDefaultPlaylist(IDが無ければnull、server 2箇所が使う)と getDefaultPlaylistTrackCount(IDが見つからなければ playlists[0]へフォールバック、client 2箇所)に分かれ、意味論が異なる。workEditSnapshotSchemaはtitle/tags/urls/coverImage/dlsiteをWorkから複製したフィールド集合で、workEditReconcileはPick<WorkEditSnapshot,'title'|'tags'|'urls'>を別途定義して使う。

裏取り（検証）: selectDefaultPlaylist(ID不一致は null)と getDefaultPlaylistTrackCount(ID不一致なら playlists[0] へフォールバック)の二系統は事実で、後者は client 2箇所(WorkDetailPage.tsx:77, useLibraryPreviewActions.ts:46)のみ。ただし workSchema が refinePlaylistCollection で defaultPlaylistId の妥当性を検証しているため、フォールバックが効く状況は契約上起きず、現実の食い違いは発生しない。『WorkSummary互換オブジェクトを手でspread』は toWorkListItem({...work, trackCount}) のことで、手書き変換というほど大きくない。EditSnapshot の重複は未検証だが軽微。

既知との関係: TASK-447.29(Done、型の中継)・TASK-468 と近接するが二重化は未カバー。

評価: getDefaultPlaylistTrackCount を selectDefaultPlaylist 経由に書き換える数行の整理は妥当だが、実害が薄く単独タスクにする価値は低い(別タスクのついでで可)。Work→WorkListItem 変換の shared 提供やサブスキーマ共通化は過剰寄り。

探索時の提案: selectDefaultPlaylistを唯一の解決関数にしgetDefaultPlaylistTrackCountはそれを使う（フォールバックは契約上存在しない前提で削除）。Work→WorkListItem変換はshared側で provide し、clientがWorkSummary偽装を作らない。EditSnapshotの共通部分(title/tags/urls)を共有サブスキーマにする。

## shared-8 sharedに互換エイリアス・テスト用フック・グローバル可変状態が残り、音声拡張子など契約値の正本が守られていない

- 判定: partial / new / severity medium
- 場所: shared/src/tagNormalize.ts:94, shared/src/tagNormalize.ts:20, shared/src/tagNormalize.ts:32, shared/src/meta.ts:41, server/src/adapters/real/paths.ts:189, server/src/adapters/real/scanAudio.ts:11, shared/src/api.ts:290, client/src/features/library/model/gridSizing.ts:4

根拠（探索）: isStoredTagNormalized は『ローカル検証スクリプト互換』コメント付きの isTagNormalized エイリアスで、リポジトリ内から参照がない（互換レイヤー禁止方針に反する残骸）。normalizeTagのバッチキャッシュは契約パッケージのモジュールグローバル変数(activeNormalizeTagBatchCache)で、テスト専用の getNormalizeTagBatchCacheStateForTests が本番exportとして同居。音声拡張子セットは shared/meta.ts AUDIO_WORK_EXTENSIONS、server paths.ts AUDIO_EXTENSIONS、scanAudio.ts AUDIO_EXTENSIONS の3つに同じ8要素の複製があり、判定関数 isAudioPath(paths.ts)と isAudioFileName(shared) も並存する。サムネイル幅の丸めも normalizeThumbnailWidth(同距離は小)・selectNearestThumbnailWidth(同距離は大)・selectCeilThumbnailWidth の3関数で、タイ規則の差はclientのコメントで補うだけ。

裏取り（検証）: isStoredTagNormalized(tagNormalize.ts:94、『ローカル検証スクリプト互換』)は参照ゼロ(backlog 以外に出現なし)で互換エイリアス残骸として事実。getNormalizeTagBatchCacheStateForTests は server/tests/tagStoredNormalize.test.ts が使うテスト専用 export。音声拡張子8要素の三重定義(shared/meta.ts:44、server paths.ts:189、scanAudio.ts:10)も事実で、isAudioPath と isAudioFileName の並存も事実。一方『グローバル状態が並行呼び出しで汚染しうる』は誤り(withNormalizeTagBatchCache は同期関数で previous を復元する)。サムネイル幅の3関数は事実だが selectCeil は client coverThumbnailWidth.ts で、normalizeThumbnailWidth は server、selectNearest は client で、いずれも使用中でありタイ規則の差はコメントとテストで担保済みと主張どおり。

既知との関係: TASK-420(Done、デッドコード・設定残骸の削除)は一般的に該当するが isStoredTagNormalized や音声拡張子三重定義は未カバー。AUDIO_EXTENSIONS で backlog 検索ヒット無し。

評価: 音声拡張子の三重定義は、shared を唯一の正にして server 側を削除する明確な負債(拡張子追加時に scan と placement 検証が食い違う実害)で、方針の『負債は今直す』にも合う。isStoredTagNormalized 削除も互換レイヤー禁止方針に沿う即時対応。テスト専用 export とバッチキャッシュの作り直し、サムネイル関数の整理は実害が無いので対象外にし、音声拡張子+互換エイリアスに絞るのが妥当。

探索時の提案: AUDIO_WORK_EXTENSIONS/isAudioFileNameをsharedの唯一の正としてserver側の複製を削除する。isStoredTagNormalizedとテスト用getterを削除し、キャッシュは呼び出し側が渡すメモ化コンテキストにするか計測で不要なら廃止する。サムネイル幅は丸め関数を用途別に1つずつ（ceilとnearest）へ整理しタイ規則を型/名前で表す。

## jobs-1 DLsite一括取得が「全件fetch→全件apply」の二相で、fetch相に進捗が無く、取消・中断で適用が全て失われる

- 判定: confirmed / new / severity medium
- 場所: server/src/adapters/real/dlsiteBulk.ts:174, server/src/adapters/real/dlsiteBulk.ts:190, server/src/adapters/real/dlsiteBulk.ts:200, server/src/adapters/real/dlsiteBulk.ts:62, server/src/adapters/real/dlsiteConfig.ts:14, server/src/dlsiteJobManager.ts:174

根拠（探索）: runDlsiteBulkは最初に fetchDlsiteBulkAttempts(uniqueRjCodes,...) で全RJコードを直列にネットワーク取得し切る(dlsiteBulk.ts:174-178)。onProgressを呼ぶのはその後のapplyループ(同:200)だけで、fetch相はprogressを一切出さない。requestIntervalMsの既定は1000ms(dlsiteConfig.ts:14)なので、N件なら最低Nx1秒のあいだprogress=null・SSEは無音。applyは全fetch完了後に始まるため、fetch相の途中で取消・サーバー再起動・オフライン例外(DlsiteOfflineErrorは再throwされジョブ全体がerror終端、同:56)になると、取得済みの作品もDLsite投影(refreshWorkProjection)に1件も反映されない。取消時のresultは {fetched:0,...} のゼロ値で返る(同:179-186、dlsiteJobManager.ts:174-181)。HTMLキャッシュ自体は残るが、投影・applied判定が進まない。

裏取り（検証）: dlsiteBulk.ts の runDlsiteBulk は先に fetchDlsiteBulkAttempts で全 rjCode を直列取得し、onProgress は後段の apply ループだけが呼ぶ。fetch相のprogressは無い。fetch後に isAborted() なら zero 初期値の result をそのまま返す。取消時の result も dlsiteJobManager.ts の catch 側で 0 固定。DlsiteOfflineError は fetchDlsiteBulkAttempts が再throwし、外側 catch が再throwするのでジョブ全体が error 終端になる。requestIntervalMs 既定 1000ms も事実。ただし apply 相は実質 result 集計と refreshWorkProjection だけで、HTMLキャッシュはディスクに残る。再実行すればキャッシュヒットで取り直しにはならない。「取得済みが1件も反映されない」は正しいが、実害は再実行で回復する範囲。また HTTP 間隔 1s が効くのは未キャッシュ分だけで、全件が1秒ずつかかるとは限らない。

既知との関係: TASK-470.2（受信側のprogress表示専用化、Done）、TASK-404（取消をerror終端にしない、Done）、TASK-428.4、TASK-460 は別側面。fetch相の無音・取消時0件・fetch→applyの二相構造を扱うタスクは見つからない。

評価: 妥当。fetch→apply→progress を作品単位に畳めば、無進捗、取消時の結果の食い違い、全件Mapの保持が同時に解消する。長期的に正しい設計で、将来構想のための一般化でもない。同一rjCodeは初出時の取得結果を使い回すだけで済む。実害は初回の大量取得時に限られ、キャッシュが残るため再実行で回復する。high ではなく medium が妥当。

探索時の提案: rjCode単位の重複排除は保ちつつ、1作品ずつ「fetch→apply→progress通知」のパイプラインに作り替える(同一rjCodeの作品は初出時にfetchし結果を使い回す)。progressのtotalは対象作品数で固定し、取消時のresultは実際の処理済み件数を返す。fetchAttemptsを一括Mapで保持する設計を廃止する。

## jobs-2 DLsite SSEにheartbeatが無く、ADR-0030の共通原則がscanにしか実装されていない（SSE配信ロジックも二重実装）

- 判定: partial / extends-known / severity low
- 場所: server/src/routes/dlsite.ts:182, server/src/routes/dlsite.ts:222, server/src/routes/scan.ts:200, server/src/serve.ts:5, server/src/routes/media.ts:19

根拠（探索）: scanのSSEは15秒間隔のpingを送る(scan.ts:200付近のheartbeat、HEARTBEAT_INTERVAL_MS)が、GET /dlsite/eventsはping処理を持たない(dlsite.ts:182-239)。サーバーのidleTimeoutは90秒(serve.ts:5)で、Bunはストリーミング応答にも適用する(ADR-0019でmediaだけserver.timeout(req,0)で無効化している根拠)。jobs-1のとおりfetch相は長時間無音になり得るため、DLsiteのSSEは90秒で切断される。クライアントはEventSource自動再接続+GET確定で吸収するため表面化しにくいが、切断のたびに再接続とGETが走る。またwriteSerialized/stop/done/unsubscribeの定型がscan.tsとdlsite.tsにほぼ同形でコピーされている。

裏取り（検証）: GET /dlsite/events に ping は無く（routes/dlsite.ts）、scan.ts には HEARTBEAT_INTERVAL_MS=15000 の ping がある。serve.ts の SERVER_IDLE_TIMEOUT_SECONDS=90 も事実。writeSerialized/stop/done の定型が scan.ts と dlsite.ts に似た形で重複しているのも事実。ただし「ADR-0030が heartbeat をscan固有扱いにしている」は誇張。ADR-0030は『scanとDLsiteで共通の原則』の節に heartbeat を挙げつつ括弧書きで scan の15秒pingと注記しているだけで、DLsite側は未実装という穴の指摘としては正しい。90秒切断は、jobs-1 が直れば progress が1件ごとに出るので、実際に起きるのは長いfetch相など限られる場面に絞られる。切断してもクライアントがEventSource再接続とGETで吸収するため、害はチャーン程度。

既知との関係: TASK-448.3（To Do）がDLsite SSEのroute切り出しで『スキャンと共通のSSEヘルパー』への移設を選択肢として明記している。heartbeat欠落とidleTimeoutの相互作用は未カバー。TASK-470/470.1/470.2、ADR-0030 は heartbeat をscan限定の記述としている。

評価: 共通SSEヘルパーへの統合は448.3の延長として妥当。heartbeat を共通で持たせるのは自然な一手。ただし独立した重大問題ではなく、448.3 のACに『heartbeatも共通化する』を足す形で吸収するのがよい。単独タスク化は不要。

探索時の提案: SSE配信を『現在状態の購読ソース＋heartbeat＋直列書き込み＋終端クローズ』を持つ共通のSSEストリームヘルパー(route層のlib)へ切り出し、scan/dlsite両方が同じ実装を使う。heartbeatは共通で持たせ、ADR-0030の記述も「SSE共通」に直す。

## jobs-3 DlsiteJobManagerのキューが作品1件ごとのジョブを積み、合流せず、状態が3変数に分裂している

- 判定: partial / new / severity low
- 場所: server/src/app.ts:89, server/src/app.ts:93, server/src/dlsiteJobManager.ts:119, server/src/dlsiteJobManager.ts:90, server/src/dlsiteJobManager.ts:151, server/src/dlsiteJobManager.ts:164, server/src/adapters/real/settingsScanMethods.ts:222, server/src/adapters/real/scanCandidateSession.ts:321

根拠（探索）: 候補登録(scanCandidateSession.registerCandidates:321のonRegistered)と作品作成(worksRoute)は、作品ごとに dlsiteJobs.enqueue("new",[workId]) を呼ぶ(app.ts:89,93)。enqueueは毎回randomUUIDで新ジョブを積む(dlsiteJobManager.ts:119-126)ので、候補をN件一括登録するとN個のジョブとN個の終端イベント・トーストが発生し、runDlsiteBulkもN回呼ばれる。lastTerminalは直近1件しか持たない(ADR-0030も「結果不明」を許容)ため、追跡ジョブが後続に押し出されると結果通知が出ない。cancel()はpendingJobsを全破棄する(同:90-92)ので、auto-fetch中の取消で他の新規作品の自動取得が黙って消える。さらに現在状態が currentJob / processingQueue / queueDrain の3変数に分かれ(同:151-162)、runQueueがreturnしてからdrainQueueのfinallyでprocessingQueue=falseになるまでマイクロタスク1〜2段の隙間があり、そこでenqueueが来るとdrainQueueが早期returnしてpendingJobsが次のenqueueまで滞留する(lost wakeup)。

裏取り（検証）: 事実: app.ts 89,93 で候補登録と作品作成のたびに dlsiteJobs.enqueue('new',[workId]) を呼び、enqueue は毎回 randomUUID で個別ジョブを積む。scanCandidateSession の onRegistered は published の作品ごとに呼ばれる。lastTerminal は1件のみ。cancel()/cancelActiveAndAwait は pendingJobs を全破棄。状態が currentJob/processingQueue/queueDrain の3変数なのも事実。scan完了側は insertedWorkIds をまとめて1回 enqueue しており、量産するのは候補登録と作品作成の経路だけ。lost wakeup は理論上は成立するが、runQueue が return してから drainQueue の finally までのマイクロタスク1段の隙間でしか起きず、enqueue がその間に割り込む確率はほぼ無い。『再現困難な自動取得が走らない不具合の温床』は誇張。pendingJobs 破棄は ADR-0029 で意図された仕様（root再設定でキュー破棄）。

既知との関係: ADR-0030 は『結果不明』を許容済み。TASK-404、TASK-470.2、TASK-428.4 はキューの合流や3変数の状態を扱っていない。同一の指摘は見つからない。

評価: 『未取得workIdのpending setを1ジョブに合流』は筋が良く、ジョブ・トースト量産とlastTerminal押し出しを同時に解く。長期的に妥当だが、実害は一括候補登録時のトースト増加程度。lost wakeup は同期区間でフラグを落とせば直る小修正で、独立の高優先度ではない。優先度は低〜中。

探索時の提案: 自動取得対象は『未取得の新規workIdの集合(pending set)』として持ち、実行中でなければ1ジョブにまとめて消化する(実行中に増えたら同一ジョブか次の1ジョブへ合流)。ループのフラグ解除とキュー空判定を同一同期区間で行い、状態をcurrentJob+pendingSetの2点に畳む。取消時に破棄される対象は、後続で再取得可能と明示するか保持する。

## jobs-4 終了処理に期限とinflight要求の待機が無く、ワーカーの協調キャンセルも無期限待ちになる

- 判定: partial / new / severity low
- 場所: server/src/serverLifecycle.ts:12, server/src/serverLifecycle.ts:18, server/src/index.ts:82, server/src/scanJobManager.ts:168, server/src/rootReconfiguration.ts:109, server/src/adapters/real/scanRunner.ts:45, server/src/lib/inFlightRequestGate.ts:20

根拠（探索）: performGracefulShutdownは server.stop()(接続を閉じない)→ app.shutdown()(root再設定→scan→DLsiteの各cancel+await)→ adapter.close() の順で、どこにもタイムアウトが無い(serverLifecycle.ts:5-33、index.ts:82-96)。スキャンの取消はAtomicsトークンを立てるだけの協調キャンセルで(scanRunner.ts:45-52)、ワーカーがネットワークドライブ等の長い同期I/Oで止まると terminate されず、cancelActiveAndAwait/shutdownが await runCompletion で戻らない。shuttingDownガードで2回目のSIGINT/SIGTERMは無視される(index.ts:84)ため、SIGKILL以外に抜ける手段が無い。また、受理済みHTTP要求(候補登録・作品更新・DLsite適用など)はshutdown中に待機されず、adapter.close()がそれらの実行中に呼ばれうる。受理済み要求を数えるInFlightRequestGateはroot再設定専用で、shutdownには使われていない。

裏取り（検証）: performGracefulShutdown は server.stop()（closeActiveConnections 指定なし）→ app.shutdown → adapter.close → dispose の順で、タイムアウトは無い。index.ts の shuttingDown ガードで2回目のシグナルは無視される。app.shutdown は rootReconfiguration→scanJobs→dlsiteJobs の順に shutdown するだけで、admittedRequestGate.drain() は使っていない（ゲートはroot再設定専用）。スキャンの取消は Atomics トークンによる協調キャンセルで、ワーカー側で長い同期I/Oが続けば settle されず terminate されない。ただし、スキャンworkerは abort 時に token を見る箇所が多数ある設計で、実際にハングするのはネットワークドライブなど特殊な環境に限られる。『書き込み途中のDB/meta書き戻しが中断される』は強制終了すれば当然で、期限を設けても期限超過の強制終了は同じ。『ワーカー側は再起動時の中断復旧が既にある設計』という記述は未検証で、根拠不明。

既知との関係: TASK-398（smokeのworker起動失敗時のサーバー停止）、ADR-0022（unhandledRejection方針）、ADR-0019（media idle timeout）は別観点。shutdown のタイムアウトと2回目シグナルは既知タスクに無い。

評価: 個人用ローカルアプリで、終了のハングは Ctrl-C 連打ができない点が不便な程度。『2回目のシグナルで即時終了』と『全体期限』は小さな変更で足せるので入れる価値はあるが、gate.drain と ワーカーterminate の段階化まで作り込むと過剰。実害は薄いので低優先。

探索時の提案: shutdownを段階化する: ①新規受付停止＋gate.drain()で受理済み要求を待つ(期限付き)、②job/workflowへcancel→期限内に終わらなければワーカーをterminate(ワーカー側は再起動時の中断復旧が既にある設計)、③adapter.close()。2回目のシグナルは即時強制終了に切り替える。期限はserverConfigに1箇所で持つ。

## jobs-5 root再設定の排他がHTTP層のmiddleware+gateだけで、drainが無期限・ロック判定が毎回DB読みで、再構築が別経路のスキャンになっている

- 判定: partial / extends-known / severity low
- 場所: server/src/lib/rootReconfigurationLockMiddleware.ts:25, server/src/rootReconfiguration.ts:79, server/src/rootReconfiguration.ts:129, server/src/rootReconfiguration.ts:153, server/src/scanJobManager.ts:113, server/src/adapters/real/settingsScanMethods.ts:161, server/src/adapters/real/settingsScanMethods.ts:182, server/src/lib/inFlightRequestGate.ts:20

根拠（探索）: (1) 排他は app.ts のHonoミドルウェアのみで、ScanJobManager.start()・DlsiteJobManager.enqueue()はロックを知らない。内部コールバック(onCompleted→enqueue)はミドルウェアを通らず、正しさは『scan→DLsiteの順にcancelする』というexecute内の呼び出し順に依存している(rootReconfiguration.ts:129-131)。(2) execute冒頭のdrainAdmittedRequests()は期限もabortも無く、受理済みのDLsite単発取得(最大60秒)や候補登録が終わるまでPOST /root-reconfigurationのレスポンスが保留される(同:129、gate drain:20-23)。(3) isLocked()はrunが無いとき毎回 getRootReconfigurationRecord()=user DBのapp_settings読み+JSON.parse+Zod parseを行う(rootReconfiguration.ts:79-82、settingsScanMethods.ts:161-169)。メディアのRange要求(8MB刻み)を含む全非許可要求に付く。(4) 再構築は ScanJobManager を通らず adapter.rebuildCatalogForRoot→scanRoot を直接呼び、完了後に scanJobs.recordCompleted() という裏口で lastCompleted とDLsite自動取得だけ模倣している(rootReconfiguration.ts:153、scanJobManager.ts:113-117)。進捗・キャンセル・状態表現がscanジョブと再設定で二系統になる。

裏取り（検証）: (1) 排他は app.ts の Hono ミドルウェアのみ、execute 内で scan→DLsite の順に cancel する点は事実。(2) drainAdmittedRequests に期限が無いのは事実だが、gate は streamSSE/メディア配信を数えない（ハンドラが Response を返した時点で leave する）。待つのは短い要求とDLsite単発取得(最大60秒)だけで、『長時間固まる』は誇張。(3) isLocked は run が無いとき毎回 getRootReconfigurationRecord を呼ぶが、中身は bun:sqlite の同期 getUserSetting が1回で、値は通常 null で JSON.parse/Zod も走らない（raw===null で早期return）。『Zod parse を毎回』は誤り。(4) 再構築が ScanJobManager を通らず adapter.rebuildCatalogForRoot→scanRoot を直接呼び、recordCompleted で lastCompleted と自動取得だけ模倣しているのは事実。ただしこれは ADR-0029 がワークフローを job manager と並ぶ独立サービスとして置く設計判断の帰結で、ADR-0029 は『リトライや待機ループは設けない』と述べるのみでdrain期限は未検討。

既知との関係: TASK-469.1（root再設定ワークフロー、Done）、TASK-459、TASK-402、ADR-0029 が設計の出処。メモリ化・rebuild の1ジョブ種別化・drain期限は未検討だが、いずれも ADR-0029 の設計判断に反する方向の再設計。

評価: 提案の核（isLocked のメモリ化、再構築を scan ジョブ種別へ統合）は ADR-0029 の設計を覆すもので、実害に対して大きい。DBの1行読みは測定上問題にならず、drain の期限も実害が薄い。drop に近い低優先。強いて言えば recordCompleted の裏口は『scan完了の後処理を1箇所にする』の小リファクタで足りる。

探索時の提案: ワークフローを排他の正本にし、再設定中/失敗の永続phaseを起動時にメモリへロード(以降はメモリのみ参照)してisLockedを同期・DBなしにする。job manager側にも『管理操作を受け付けるか』のガードを持たせるか、再構築を ScanJobManager の1ジョブ種別(rebuild)として実行して一本化する。drainには期限を設け、期限超過は受理済み要求のabortSignal等で打ち切る。

## jobs-6 スキャンworkerのサムネイルGCが、メインスレッドのサムネイル生成中の.tmpや新規登録分を消し得る（クロススレッド協調が無い）

- 判定: partial / new / severity low
- 場所: server/src/adapters/real/thumbnailCache.ts:250, server/src/adapters/real/thumbnailCache.ts:256, server/src/adapters/real/thumbnailCache.ts:258, server/src/adapters/real/scanFinalize.ts:38, server/src/adapters/real/scanWorker.ts:212

根拠（探索）: finalizeScanはscanWorker内(別スレッド・別DB接続)で gcThumbnailCache を実行し、validNames(自接続のcatalogスナップショット由来)に無いエントリを全て削除する。生成中の一時ファイル `.tmp-<pid>-<n>` は命名上『孤児として常に削除対象』で、コメントで『renameがENOENTで失敗しうるが頻度が低いので許容する』と明記されている(thumbnailCache.ts:250-256)。一方メインスレッドのThumbnailCacheは、スキャン中もグリッド表示のカバー要求で生成を続ける。さらにスナップショット後にメイン側で登録された作品のサムネイルも有効集合に無いため削除される。

裏取り（検証）: thumbnailCache.ts 250-258 のコメントで、GC が .tmp- を孤児として削除し、生成中なら rename が ENOENT で失敗しうるが許容すると明記されている。finalizeScan は scanWorker 内で gcThumbnailCache を実行する（別スレッド）。メイン側の ThumbnailCache は並行して生成を続ける。ここまでは事実。ただしスナップショット後に登録された作品のサムネイル削除は、サムネイルが要求時に再生成されるキャッシュなので実害なし（誇張）。.tmp 削除によるカバー500は、スキャン完了の瞬間にちょうど生成中だった場合のみで、クライアントは再試行できる。

既知との関係: TASK-448.4（finalizeScan呼び出し経路の一本化、To Do）は経路の話で、GC と生成の競合は別。ADR にも該当記述は無い。

評価: 『.tmp- は GC の対象外にし、古い tmp だけ mtime で掃除』は数行で直る正当な修正で、『許容する』コメント前提の設計は確かに弱い。ただし競合窓が極小でキャッシュの再生成で回復するため、独立タスクにするほどではない。448.4 の作業の際に一緒に直せば十分。

探索時の提案: GCは生成中の命名規則(.tmp-)を対象外にし、stale tmpの掃除は起動時または十分古い(mtime閾値)ものに限る。スナップショット後の追加分を守るため、削除対象も『最終アクセス/mtimeが一定以上古い』ものに絞る。『許容する』コメントを前提にした設計はやめる。
