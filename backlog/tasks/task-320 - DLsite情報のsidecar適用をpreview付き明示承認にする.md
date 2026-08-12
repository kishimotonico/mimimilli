---
id: TASK-320
title: DLsite情報のsidecar適用をpreview付き明示承認にする
status: To Do
assignee: []
created_date: '2026-08-12 12:18'
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
- [ ] #1 DLsite取得が完了しても自動でsidecarへ適用されない
- [ ] #2 取得の一時状態（HTML・HTTP状態・retry・lastAttemptAt）がsidecarへ書かれずcacheに置かれる
- [ ] #3 preview差分がフィールド単位で現値と取得値を対比表示する
- [ ] #4 既定は未設定フィールドのみ適用で、上書きはフィールド単位で選択できる
- [ ] #5 複数作品への一括適用（未設定項目のみ）ができる
- [ ] #6 適用がCAS編集経路を通り、pnpm test:smokeが通る
<!-- AC:END -->
