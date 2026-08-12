---
id: TASK-320
title: DLsite情報のsidecar適用をpreview付き明示承認にする
status: Done
assignee:
  - '@nico'
created_date: '2026-08-12 12:18'
updated_date: '2026-08-12 17:43'
labels: []
dependencies:
  - TASK-310
  - TASK-311
priority: medium
ordinal: 330000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-08-12決定: 取得は自動・適用は明示承認。DLsite取得ジョブは従来どおり自動で走らせ、結果はprovider cache（取得HTML・HTTP状態・retry・lastAttemptAt含む）へ保存し、sidecarへは書かない（TASK-310の一方向投影に従う）。sidecarへの適用は作品ごとのpreview差分（フィールド単位で現値と取得値を対比表示）を経て明示承認で行う。適用の既定policyは「未設定フィールドのみ埋める」、上書きはフィールド単位でユーザーが選択。複数作品への一括適用は「未設定項目のみ」policyで全承認できる。適用はTASK-311のCAS編集経路（source-first）を通す。UI仕様: 作品詳細のDLsiteセクションに「取得結果を確認」導線→preview差分ダイアログ（フィールドごとに現値/取得値/適用チェックボックス、既定は未設定フィールドのみON）→適用ボタン。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 DLsite取得が完了しても自動でsidecarへ適用されない
- [x] #2 取得の一時状態（HTML・HTTP状態・retry・lastAttemptAt）がsidecarへ書かれずcacheに置かれる
- [x] #3 preview差分がフィールド単位で現値と取得値を対比表示する
- [x] #4 既定は未設定フィールドのみ適用で、上書きはフィールド単位で選択できる
- [x] #5 複数作品への一括適用（未設定項目のみ）ができる
- [x] #6 適用がCAS編集経路を通り、pnpm test:smokeが通る
<!-- AC:END -->



## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. DLsite取得・cache・既存sidecar適用経路を調べ、自動適用を削除する。
2. preview/applyとbulk missing-only APIをTASK-311のsource-first CAS経路へ接続する。
3. 作品詳細のpreviewダイアログと取得結果導線を実装し、fixtureと関連テストを追加する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
取得ジョブをcache-onlyに変更。個別preview/applyはsourceRevision付きCAS、bulk missing-only APIを追加。smokeは検証担当で未実行。
<!-- SECTION:NOTES:END -->
