---
id: TASK-351
title: 候補登録後に未登録件数が古いまま更新されないことがある
status: To Do
assignee: []
created_date: '2026-08-17 21:08'
updated_date: '2026-08-17 23:14'
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
- [x] #4 候補キャッシュの上書き経路が特定され、原因（ScanRuntimeのhandleScanTerminal再入で登録後の候補がスキャン結果全件で上書きされる）が再現テストで縛られている。フォールバック仮説（候補B）の棄却根拠もnotesに記録されている
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
<!-- SECTION:NOTES:END -->
