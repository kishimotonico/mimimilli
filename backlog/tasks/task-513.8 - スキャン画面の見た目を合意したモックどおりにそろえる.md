---
id: TASK-513.8
title: スキャン画面の見た目を合意したモックどおりにそろえる
status: Done
assignee: []
created_date: '2026-11-20 19:48'
updated_date: '2026-11-20 20:50'
labels: []
dependencies: []
parent_task_id: TASK-513
priority: high
ordinal: 596000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-513.1〜7の実装は既存UI部品に寄せたため、合意したモック（ユーザー確認済み）から見た目がずれた。既存部品に合わせずモックを忠実に再現し、必要な部品・トークンは新設してdesign-system.mdを更新する。ずれの一覧は統括の監査資料。ID重複の取り込みボタンは推奨アクション列へ移し、未登録パス行と同じ高さに置く（2026-11-21ユーザー決定）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 縦タブ・サイドバー幅・件数表示・要対応バッジがモックの寸法・文字・色と一致する
- [x] #2 4タブの見出し行と行の高さ・文字の強弱がモックと一致し、要対応タブに他タブと異なる余白や隙間がない
- [x] #3 一覧のカバー画像と仮カバーが36pxの正方形にトリミングされ、行ごとに大きさが変わらない
- [x] #4 要対応のID重複は登録済み・未登録のラベルが左列でパスと同じ行に並び、取り込みボタンは推奨アクション列の該当パス行と同じ高さにある
- [x] #5 更新済みの絞り込みと未登録の問題ありチップがモックの丸チップで共通部品になり、全選択が見出し行の先頭にある
- [x] #6 チェックボックス・行方不明の旧パス・状態欄の日時がモックどおりで、design-system.mdに新しい部品と一覧の仕様が書かれている
- [x] #7 pnpm check・pnpm test・pnpm test:smokeが通り、モックと実装のスクショ比較レビューでずれが残っていない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
モック対比のスクショ比較を2回（cmp-513.8, cmp2-513.8）とOpusレビュー4回を経て 4a2dbce2 で feat/scan-redesign に集約。check/test/smoke pass。DLsite適用ダイアログの「追加されるタグ」の詰まりは既存の問題で範囲外。スキャン実行中・中止受付中・失敗の状態欄はfixtureで撮れずモック対比未実施
<!-- SECTION:NOTES:END -->
