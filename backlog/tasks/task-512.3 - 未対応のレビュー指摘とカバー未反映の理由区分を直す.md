---
id: TASK-512.3
title: 未対応のレビュー指摘とカバー未反映の理由区分を直す
status: Done
assignee: []
created_date: '2026-11-19 15:00'
updated_date: '2026-11-19 15:39'
labels: []
dependencies: []
parent_task_id: TASK-512
ordinal: 585000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー（tmp/task-512/advisor-decisions.md の1・2）で残った指摘を直す。クライアントの候補隠し（scanCandidateHiddenPathsAtom）はサーバーの判定と真実の源が二重なので撤去する。tagPrefixes.test.ts の infoRevision 既定値が数値のままで400テストが空振りしている。listScanCandidates がルート未設定時に NotConfiguredError を投げるようになった副作用を戻す。UnregisteredTab の全件失敗時の特例を消す。DLsite適用・登録でカバーを反映しなかったとき（ルート外のsymlink・画像として読めない・キャッシュに無い）、成功はそのままに応答で理由区分を返し、既存の通知に短く添える。ADR-0033のカバーのベストエフォートの一文とADR-0028の「スキャン候補は非表示集合で揃える」段落を、新ADRで置き換える（docs/adr/README.md の規則どおり既存ADRの本文は書き換えない）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 tagPrefixes.test.ts の400テストが、スキーマ違反でなく意図したタグ検証で400になることを確かめている
- [x] #2 ルート未設定時の候補一覧の挙動が、クライアントの扱いと一貫している（テストで固定）
- [x] #3 未登録タブで中断なしに全件失敗しても「0件を追加しました」の通知が出ない
- [x] #4 カバーを反映しなかった適用・登録が、成功のまま応答で理由区分（ルート外・読めない・キャッシュに無い）を返し、クライアントが既存の通知に短く添える
- [x] #5 新ADRがADR-0033のカバーの扱いとADR-0028の非表示集合の段落を置き換え、check・test・smoke が通る
- [x] #6 scanCandidateHiddenPathsAtom とその参照が無くなり（client・server・shared で rg scanCandidateHiddenPaths が0件。ADR本文は対象外）、登録解除した作品のフォルダーが次のスキャンを待たずに未登録タブの候補に戻る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
登録状況を変える操作の後はサーバーから候補を取り直す形に一本化し、クライアントの非表示集合（scanCandidateHiddenPathsAtom）を撤去した。適用・Files登録・候補からの登録の応答に coverSkipped（outside_root/unreadable/not_cached）を載せ、UIは区分を出し分けず既存の通知に「カバーは適用できませんでした」を添える。ルート未設定の候補一覧は空を返す。候補の追加が0件ならトーストもタブ移動もしない（リクエスト中に別タブへ移って0件だった場合に何も見えないのは対応なし: 候補は未登録タブに残り件数も変わらないので追加されなかったことは見える）。登録・解除・読み直し・再採番・スキャン完了の onSuccess は候補の取り直しを待つので、応答待ちが1往復長くなる（サーバー側はメモリ上の絞り込みのみ）。ADR-0036 を追加。
<!-- SECTION:FINAL_SUMMARY:END -->
