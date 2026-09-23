---
id: TASK-459
title: root再設定時に候補除外を破棄することを明示する
status: Done
assignee: []
created_date: '2026-09-21 10:49'
updated_date: '2026-09-23 22:17'
labels: []
dependencies: []
ordinal: 513000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
scan_candidate_exclusions が root 相対 path のみを主キーに持ち root を識別しないため、root を変更すると除外の意図が無関係な root へ漏れ得る。単一の稼働ライブラリを置き換える使い方を前提に、再設定時は除外を破棄する。将来のプロファイル切り替え構想を根拠に root 別保持へ一般化しない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 再設定で破棄される状態と保持される状態がユーザーに示される
- [x] #2 Work ID に紐づく履歴と root 依存の状態が区別されている
- [x] #3 無関係な root へ除外の意図が漏れない
- [x] #4 有効なroot変更が成立したときに候補除外が破棄される。同一rootの再保存で破棄するかどうかが定義されている
- [x] #5 失敗したroot変更で候補除外が破棄されない
- [x] #6 旧rootの候補sessionから新rootへ除外を書き込めない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC4決定: 同一root（realpath正規化後で旧値と一致）の再保存では候補除外を破棄しない。破棄条件は「正規化後の旧rootがnullでなく、かつ新rootと異なる」。初回設定（旧rootがnull）は破棄対象なし。ScanCandidateSessionもroot変更と同じ処理単位でリセットする（listScanCandidatesが旧rootの候補を返さないようにするため）。API契約（GET/PUT /settingsのレスポンス形）は変更せず、破棄の告知は保存前ヒント（設定モーダルのルートフォルダー編集フォーム）で行う。
<!-- SECTION:NOTES:END -->
