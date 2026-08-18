---
id: TASK-351
title: 候補登録後に未登録件数が古いまま更新されないことがある
status: In Progress
assignee: []
created_date: '2026-08-17 21:08'
updated_date: '2026-08-18 03:03'
labels: []
dependencies: []
ordinal: 361000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スキャンダイアログで候補をライブラリに追加したあと、サイドバーの未登録タブとトップバーの件数が登録前の値のまま更新されないことがある。

## 症状（TASK-342の調査中に統括が独立に再現・確認）

client/tests/smoke/library.smoke.spec.ts の「スキャン完了後に候補を選択登録でき、問題をFilesで確認できる」で、2件を追加したあとの状態が次のようになる（error-context.md より）:

- button "スキャン（未登録2件）"  ← トップバーが登録前のまま
- tab "未登録（2件）"              ← サイドバーも登録前のまま
- 一方で新規登録済みタブは aria-selected=true で、登録された2件も表示されている

登録自体は成功し、自動切り替え（remainingCount===0 が条件）も完了してUIは落ち着いている。それでも件数だけが古い値で確定する。レンダー遅延ではない。

再現率はフルスイート実行で5〜6回に1回程度。単体実行では再現しにくい。

## 原因の仮説（未確定・要検証）

client/src/features/scan/model/useScanCandidatesCache.ts の readScanCandidates が、SCAN_QUERY_KEYS.candidates() のキャッシュが undefined のとき last?.result.candidates（前回スキャン結果）へフォールバックする:

  const cached = queryClient.getQueryData<ScanCandidate[]>(SCAN_QUERY_KEYS.candidates());
  if (cached !== undefined) return cached;
  const fromLast = syncScanCandidatesFromLast(last, undefined);
  if (fromLast !== undefined) return fromLast;

登録後に候補キャッシュが空配列で上書きされず削除・リセットされる経路があると、このフォールバックが前回スキャン時の候補を返し続け、件数が古い値で固定される。観測された症状と整合する。

## 進め方

仮説の確定を先に行うこと。候補キャッシュがいつ undefined になるか（削除・リセットの実経路）を特定し、ユニットテストか一時計装で「last?.result.candidates へのフォールバックが原因」であることを再現で縛ってから修正する。原因未確定のままフォールバックを削除するだけの対応は不可。

修正の設計判断は担当に委ねるが、方向性として『前回スキャン結果への暗黙フォールバック』という途中状態の混入自体が症状源なので、このフォールバックが何のために入ったかを確認し、不要であれば削除する筋も検討すること。

関連: TASK-342（このタスクの完了後にフレーク解消を再検証する）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 候補を登録したあと、サイドバーの未登録タブとトップバーの件数が登録結果を反映する
- [x] #2 原因構造が修正されている（暗黙フォールバックの存在意義を確認したうえでの判断がタスクnotesに記録されている）
- [x] #3 client側テストが通り、smokeフルスイートを5回連続実行して library.smoke.spec.ts の候補登録テストが失敗しない
- [x] #4 巻き戻しの経路が実測で特定されている（handleScanTerminalが登録の約35ms後にスキャン時点のスナップショットで上書き。同一finishedAtの二重呼び出しではなく遅延到着）。原因が再現テストで縛られている
- [ ] #5 候補キャッシュが未確定（bootstrap応答前）の状態で登録・除外を行っても、表示中の候補が消去されない。部分更新の前提が無い場合の扱いが設計として決まっている
- [ ] #6 サーバー再取得が並行したとき、解決順ではなく発行順で後発が優先される（古い先発応答が後着で勝たない）
<!-- AC:END -->









## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 原因確定（実測）

候補Aが原因。候補Bは今回の症状経路ではない。

### 候補A（確定）
ユニットテスト `useScanCandidatesCache.test.ts`「候補A: 登録後に handleScanTerminal 相当の書き込みが走ると件数が戻る」で再現。
1. 候補キャッシュを2件で初期化
2. UnregisteredTab と同じ filter で登録（空配列）
3. `applyScanTerminalCandidates`（旧 handleScanTerminal の candidates 書き込み）を同じ finishedAt で実行
→ 修正前はキャッシュが2件に戻り件数が復元される。

実経路: useScanJob は SSE の completed/failed/cancelled で `refresh()`（GET /scan/:id）を呼び、非同期で `onTerminal` が走る。登録成功の setQueryData より後に terminal 副作用が到着すると、スナップショットの全候補で上書きされる。

### 候補B（棄却）
フォールバック自体は `removeQueries` 等でキャッシュが undefined になったときに last.result.candidates を返す（テスト「候補B: キャッシュが undefined のときだけ…」で確認）。
ただし登録成功時は空配列 `[]` がキャッシュに残るため、本番コードに candidates キャッシュを undefined にする経路は見つからず（removeQueries/resetQueries/gc による削除なし）、今回の「登録後に件数が戻る」症状の直接原因ではない。

### 暗黙フォールバックの存在意義
TopBar が /scan/candidates を叩かずに初回表示件数を出すため（topBarUnregisteredBadge.test「前回スキャン結果から件数を導出する」）。ScanModal は undefined 時に refreshScanCandidates するが、TopBar 単体表示ではフォールバックが必要。登録後はキャッシュが優先されるため削除不要。

### 修正
`syncScanTerminalCandidates.ts` の `applyScanTerminalCandidates` を追加。同一 finishedAt の再入時、キャッシュがスナップショット候補の部分集合なら（登録・除外後）上書きしない。新スキャン（finishedAt 変更）は従来どおり全置換。

### 負の検証
applyScanTerminalCandidates を常時上書きに戻すと候補Aテストが失敗（2件に復元）。

### smoke
5回連続: 15 passed / 37s, 37s, 37s, 36s, 36s。library.smoke 候補登録テスト含め全通過。残留プロセスなし。

### AC#1
起票時の候補B前提のため未チェック。文言修正が必要。

修正の設計を差し替え（統括レビュー後）: 初版は last() 更新後に prevLast を読んでいたため再入判定が常にtrueで、部分集合チェックが誤って再入判定の役目を負っていた（前回⊆今回のとき新スキャン結果が反映されない誤判定あり）。applyScanTerminalCandidates を last() 更新より前に呼ぶ順序へ変え、prevFinishedAt === finishedAt なら触らない・新しければ全置換、へ簡素化。部分集合チェックは削除。負の検証: 再入判定を外すと候補Aテストが落ち（[]が2件に復元）、旧実装に戻すと新スキャンsupersetテストが落ちる（[A]のまま[A,B]へ更新されない）。client 816 passed、smoke2回全通過。

## 再調査（refreshScanCandidates in-flight）

統合ブランチで applyScanTerminalCandidates 再入ガード入りでも smoke 2/5 失敗。handleScanTerminal 再入説は棄却（useScanJob の terminalHandled で同一 job の onTerminal 二重呼び出し経路なし）。

### 真の原因（ユニットで確定）
ScanModal マウント時（cache undefined）に飛ぶ refreshScanCandidates の GET が遅延し、登録後に setQueryData すると古い候補一覧へ巻き戻る。refreshScanCandidates.test「bootstrap 中にキャッシュが埋まったあとの遅延応答は適用しない」で再現。

### 修正
- refreshScanCandidates: 発火時に cache が undefined だった場合、応答到着時に既に cache が定義されていれば適用しない（shouldSkipStaleBootstrapRefresh）
- 409 / 除外復元 / 設定画面の復元は `{ force: true }` でサーバー正を維持
- applyScanTerminalCandidates は削除（誤った原因へのパッチワーク。ScanRuntime は直接 setQueryData に戻した）

### 負の検証
- shouldSkipStaleBootstrapRefresh 適用を外すと bootstrap 遅延テストが失敗（[] が [A,B] に戻る）

### smoke 5回
15 passed×4 (36-36s)、RUN2のみ候補登録テスト1件失敗（14 passed）。単体再実行は成功。残留プロセスなし。

計測ラウンド（console実測・修正なし、2026-08-18）: smoke 10回中1回で再現。失敗回の candidates 書き込みシーケンス（performance.now ms）:

1605.3 refreshScanCandidates（bootstrap初回） → 2件
1625.0 refreshScanCandidates SKIP（stale bootstrap ガードが作動）
2248.4 register POST response（items=2, 42ms）
2248.8 UnregisteredTab.registerMutation.onSuccess → 0件
2283.5 ScanRuntime.handleScanTerminal → 2件  ← 巻き戻し

巻き戻しの経路は handleScanTerminal で確定。ただし観測されたのは1回だけで、同一 finishedAt での二重呼び出しではない。terminal が登録の約35ms後に遅れて到着し、スキャン時点のスナップショット（2件）を、登録で更新済みのキャッシュ（0件）へ上書きしている。

refresh bootstrap ガードは今回の失敗には無関係（SKIPが作動しており、register後のrefresh書き込みは観測されず）。

## 4周目: 世代方式への統一（承認済み設計）

### 棄却したもの
- handleScanTerminal 再入ガード（実測で terminal 書き込み1回のみ。復活なし）
- shouldSkipStaleBootstrapRefresh / force オプション（世代方式で代替し削除）
- terminal での result.candidates 直書き（スナップショット押し込み廃止）

### 実装
- scanCandidatesCache.ts: 候補キャッシュの revision。ローカル更新（登録・除外）とサーバー同期はすべて世代を進める
- refreshScanCandidates: 発行時 revision を保持し、応答到着時に変わっていれば破棄（bootstrap・terminal）
- syncScanCandidatesFromServer: 409/復元/設定向け。世代に関わらずサーバー正を適用
- ScanRuntime: last() 更新後に refreshScanCandidates のみ（スナップショットはキャッシュへ入れない）

### 負の検証
- applyScanCandidatesIfRevisionCurrent の世代チェック無効化で「登録後スナップショット」「bootstrap遅延」の2テストが失敗

### smoke 5回
15 passed × 5（39s, 37s, 36s, 38s, 36s）。残留プロセスなし。

最終設計（統括レビュー後の整理）: 候補キャッシュを client/src/entities/scan/scanCandidatesCache.ts へ一元化し、exportは SCAN_CANDIDATES_QUERY_KEY / updateScanCandidatesCache / refreshScanCandidates の3つのみ。refreshScanCandidatesが発行時の世代を捕まえ、応答到着時に世代が変わっていたら破棄する。世代はprivateな兄弟キー['scan','candidatesRevision']。5周の試行で積もった投機的ガード（syncScanTerminalCandidatesの再入ガード、shouldSkipStaleBootstrapRefresh、forceオプション、syncScanCandidatesFromServer）はすべて削除。未使用になったgetScanCandidatesも削除し、それを参照して空振りになっていたtopBarUnregisteredBadge.testを実fetch経路の検証へ直した。設計方針はCodexのセカンドオピニオンでも裏付け済み（useQuery+invalidateだけではTopBarが/scan/candidatesを常時取得することになり遅延取得の設計が変わるため、鮮度管理は必要）。統括の独立検証: client unit 817 passed、pnpm check全パス、smokeフルスイート10回連続で全通過（修正前は3回に1回失敗）。
<!-- SECTION:NOTES:END -->
