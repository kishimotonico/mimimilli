---
id: TASK-517.6
title: 層の開閉と保存後の入り直しを単純にし、遷移のバグを直す
status: To Do
assignee: []
created_date: '2026-11-23 12:49'
updated_date: '2026-11-23 12:50'
labels:
  - library
  - client
dependencies:
  - TASK-517.5
parent_task_id: TASK-517
priority: high
ordinal: 629000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
層の補正の引き継ぎ（LayerCarry・closesLayerBelow・revisitedCarry・ParseContext.delta）、np=1 と openedBy、pushSameUrl、clearLibrarySort/clearLibraryGroupSort をなくす。await 後の入り直しは「始めたときの route から動いていなければ移る、動いていれば何もしない」の1分岐にする。レビューで見つかった遷移のバグも同じ規則で直す。並べ替えの直列キューは保存中のドラッグ不可にして消す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 層は履歴エントリーの状態だけに書かれ、URL に np が無く、閉じると1件戻る（連続で閉じても2件戻らない）
- [ ] #2 保存・上書き・作成・削除の await 中に画面・層・絞り込み・選択を変えたとき、完了後もユーザーが変えた状態が保たれる
- [ ] #3 登録解除の完了時、選択や詳細の作品が解除した作品のときだけ外れ、開いている層やほかの作品の詳細は変わらない
- [ ] #4 グループ分けを変えて保存したとき、古い ?group= での作品一覧の取得（400 や一瞬の0件）が起きずに値一覧へ移る
- [ ] #5 既定の並びの保存の成功応答が一覧のキャッシュにすぐ反映される
- [ ] #6 routeStore と useRouteHistorySync が項目専用のオプション（pushSameUrl・delta）を持たない
<!-- AC:END -->
