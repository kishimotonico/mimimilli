---
id: TASK-529.1
title: Ark UI を導入し、共通層とボタン起点のメニューを置き換えて見た目をそろえる
status: To Do
assignee: []
created_date: '2026-11-26 03:15'
updated_date: '2026-11-26 03:16'
labels:
  - ui
dependencies: []
parent_task_id: TASK-529
priority: high
ordinal: 649000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
@ark-ui/react を導入し、薄い共通層（メニュー部品、退出アニメーションの間 Ark の寿命を延ばすフック、見た目のクラス）を作る。shared/ui/Menu.tsx の PopupMenu と、role="menu" を手書きした6箇所（WorkMetadataActions、FilesAddressBarMenu、SidebarAddMenu、LibrarySortMenu、PlaybackRatePicker、WorkPlayButton）を Ark のメニューへ置き換える。
見た目の推奨案: パネル角 6px（--r-2）、枠 --line-soft、影 --shadow-pop、内側余白 4px、項目の高さ 28px、項目角 4px、文字 --fs-body。選択中は左のチェックの列（14px）に --acc 色のチェック（背景と太字は使わない。チェックやラジオを含むメニューだけ列を確保）。項目にアイコンは付けない。右端に件数（--ink-3、等幅 11px）、ショートカットは出さない。危険な項目は常に --state-danger で区切り線の下。区切り線 --line-soft、小見出し 10px・600・字間 .08em・--ink-2。幅は内容幅・最小 180px（再生速度だけ 112px）、長いラベルは省略記号。ハイライトはホバーもキーボードも --paper-2、無効は --ink-4。アンカーとの間 6px。出入りは不透明度と scale .96→1 を 0.12s。
ADR-0043 の帰結のうち、フォーカスの戻し先と backdrop のガードはこのタスクで決める。参考の試作: .worktrees/task-525-ark-ui/client/src/proto/（捨てる前提）。
関連: ADR-0043、TASK-525、doc-10。見た目の推奨案モック: https://claude.ai/artifact/RQNfTz8bxxPgvJgzChA5di 。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 @ark-ui/react が入り、共通層（メニュー部品・寿命を延ばすフック・見た目のクラス）がある。各所は Ark の部品を直接組み、汎用ラッパーは作らない
- [ ] #2 PopupMenu と手書きの role="menu" 6箇所が Ark のメニューになり、矢印移動と先頭文字移動が使える
- [ ] #3 見た目がモックの推奨案どおりである（スクリーンショットで確かめる）
- [ ] #4 退出アニメーションが付き、退出中は inert で中身が変わらない
- [ ] #5 閉じた後のフォーカスの戻し先（Esc・項目実行・外側クリック）が意図どおりで BODY を経由しない。繰り返し測る。プログラムの focus() でメニューを閉じてしまう箇所と、フォーカスできない領域のクリック後の戻りも確かめる
- [ ] #6 Esc で内側の層から一段ずつ閉じる（ネイティブ dialog の中のメニューを含む）。IME 変換中の Esc・Enter で閉じも実行もしない
- [ ] #7 ネイティブ dialog の中のメニューを開いたまま backdrop をクリックすると、メニューだけが閉じる（ガードの形はこのタスクで決める）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
導入する @ark-ui/react のバージョンは、公開から7日以上経ったものを選ぶ（min-release-age の設定は変えない）。試作は 5.40.1 で確かめたので、それより古い版を選ぶ場合は、試作で確かめた挙動（Esc の層、present、ContextTrigger）が同じか確かめる。
<!-- SECTION:NOTES:END -->
