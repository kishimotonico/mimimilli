---
id: TASK-516.12
title: 最終レビューで見つかったコードの負債を直す（検索語・権限・変換・無効化・行き先）
status: Done
assignee: []
created_date: '2026-11-22 15:25'
updated_date: '2026-11-22 15:51'
labels:
  - library
dependencies: []
parent_task_id: TASK-516
priority: high
ordinal: 613000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-516 の最終レビュー（Fable）の should-fix のうち、コードの挙動と設計に関わるもの。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 buildEffectiveCondition が検索語を trim し空なら text を足さない。表示中と保存直後で同じ作品が見え、空白だけの検索語で保存が 400 にならない
- [x] #2 スマートフォルダーの権限の規則が shared の1か所にあり、client の UI 判定と server の検証がそれを使う。core は HTTP 例外に依存せず、route が 403/400 に写す
- [x] #3 グループの値からタグ・述語への変換と年の検証が shared の1か所にあり、shared・server・client がそれを使う
- [x] #4 スマートフォルダーの変更（作成・更新・削除・復元・並べ替え・既定の並びの保存・壊れた行の削除）が1つの編集の口を通り、失敗はトーストで見せ、404/409 でも一覧を取り直す。単体テストがある
- [x] #5 作品詳細などライブラリ以外の画面で開いているスマートフォルダーを消しても、保持しているライブラリの folderId が all に置き換わる
- [x] #6 お気に入りの後にグループの値一覧を無効化する。再生の後に無効化しない根拠を ADR-0040 に1行書く
- [x] #7 条件の検証エラーがスキーマの文言を返し、契約テストの意味表にタグの完全一致と大文字小文字の独立した期待値があり、値一覧の HTTP テストが件数つきの完全一致になっている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装完了(未コミット, worktree task-516.12)。壊れた all は resolveLibraryView の throw を維持(ADR-0040: all が無い状態を扱うコードは書かない)、権限は remove=false。壊れた行へのPUT(作り直し上書き)はサーバーで従来どおり受ける(定義は規則に合うこと)。
<!-- SECTION:NOTES:END -->
