---
id: TASK-351
title: 候補登録後に未登録件数が古いまま更新されないことがある
status: In Progress
assignee: []
created_date: '2026-08-17 21:08'
updated_date: '2026-08-17 21:09'
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
- [ ] #1 候補キャッシュが undefined になる実経路が特定され、last?.result.candidates へのフォールバックが件数据え置きの原因であることが再現で縛られている
- [ ] #2 候補を登録したあと、サイドバーの未登録タブとトップバーの件数が登録結果を反映する
- [ ] #3 原因構造が修正されている（暗黙フォールバックの存在意義を確認したうえでの判断がタスクnotesに記録されている）
- [ ] #4 client側テストが通り、smokeフルスイートを5回連続実行して library.smoke.spec.ts の候補登録テストが失敗しない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
統括による追加調査（2026-08-18）: 起票時の仮説（useScanCandidatesCache の last?.result.candidates フォールバック）より有力な経路が見つかった。候補キャッシュへの書き込みは2箇所ある。

1. client/src/features/scan/ui/ScanRuntime.tsx:31 handleScanTerminal — job が completed になったとき queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), result.candidates) でスキャン結果の候補全件をそのまま書き込む
2. client/src/features/scan/ui/scanModal/UnregisteredTab.tsx:60 registerMutation.onSuccess — 登録済みpathを previous.filter で取り除く

1が2の後に走ると、登録で減らしたはずの候補がスキャン結果の全件（今回は2件）で上書きされ、件数が登録前の値に戻る。観測された『登録は成功しUIも落ち着いているのに件数だけ2のまま確定』と整合する。

したがってAC#1の検証では、フォールバック経路と ScanRuntime の上書き経路の両方を候補として切り分けること。どちらが実際に起きているかを再現で確定させてから修正する。
<!-- SECTION:NOTES:END -->
