---
id: TASK-516.21
title: 最終再レビューの指摘を直す（上書きの競合・作成後の誤遷移ほか）
status: Done
assignee: []
created_date: '2026-11-22 22:13'
updated_date: '2026-11-22 23:01'
labels:
  - library
  - ui
dependencies: []
parent_task_id: TASK-516
priority: high
ordinal: 622000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-516 の master マージ前の最終再レビュー（Astra、8eff98ce）の指摘。結果ファイル: /tmp/claude-1000/-home-nico-projects-mimikago/astra-rereview-516-result.md。統括判断: 上書きの競合はサーバーの楽観ロックではなく、上書き・取り消しが自分の変えた項目だけを更新する形で直す（同じ項目の同時編集は後勝ちでよい）。Fable の再レビュー結果も届き次第ここに足す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 検索の上書きとその「元に戻す」は、上書きで変わる項目だけを更新し、別に保存された名前・並び・値の並びなどを巻き戻さない
- [x] #2 作成・既定からの追加の成功応答は一覧のキャッシュへすぐ反映され、一覧の再取得が失敗しても新しいフォルダーを開いたまま「すべて」に戻らない
- [x] #3 上書きを待つ間に検索語・チップ・選択・並びを変えたら、完了時の入り直しでそれを消さない
- [x] #4 保存中の編集ダイアログは入力欄もすべて操作できず、失敗したら同じ下書きで再開できる
- [x] #5 値一覧の列見出しで並びを変えても、押した見出しにフォーカスが残る
- [x] #6 ADR-0041 の検索の push の記述が、ファイル画面の検索欄が無効であることと合っている
- [x] #7 pnpm test:smoke を含めて pnpm check・pnpm test が通る
<!-- AC:END -->















## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fable 再レビュー（8eff98ce、must-fix なし・マージ可）の指摘も同じタスクで直す:
- design-system.md:224 の編集ダイアログの欄を「名前・条件・グループ分け・（グループ分けがあれば）値の並び・作品の並び（なければ既定の並び）」にし、保存中は閉じられないことを1文。
- ADR-0041 の resolveLibraryView の「値一覧は並びを要さない」を「値一覧は作品の並びを要さない（値の並びは行自身が持ち、継承しない）」に。
- ADR-0040 の値の並びだけの更新に 409 を足す。ADR-0028:135 を「既定の並び（作品・値）」に。
- 統括判断: グループ分けが追加年のとき、値の並びの名前順のラベルは「年（古い順）」「年（新しい順）」にする（並びメニューとダイアログの両方。ほかのグループ分けは今の名前順のラベル）。
- パンくずの兄弟値ポップオーバーの key を folderId と groupSort を含む形にして、開いたまま別のフォルダーへ移っても古い並びが残らないように。
<!-- SECTION:NOTES:END -->
