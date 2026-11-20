---
id: TASK-513.6
title: 未登録タブの行表示と「問題あり」の絞り込みを直す
status: To Do
assignee: []
created_date: '2026-11-20 10:40'
labels:
  - scan
  - ui
dependencies:
  - TASK-513.5
references:
  - 'https://claude.ai/artifact/XvdN9UKvcg9GtL2gixXQ34'
documentation:
  - docs/adr/0039-scan-modal-current-problems-and-explicit-states.md
parent_task_id: TASK-513
priority: high
ordinal: 594000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0039「未登録タブは取得・追加・除外を分ける」のうち行の表示。今はRJコードの形式エラーの理由がhoverにしか出ず行が黙って件数から外れる（監査M3。TASK-428.19 AC#3の退行）、省略されたタイトルの全文もパスも見えず同名フォルダーを区別できない（M8）、行内の「修正」「再試行」が文字にしか見えない（L4）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 RJコードが形式（RJ_CODE_PATTERN）に合わないとき入力欄の下に短い理由が出て、Escで元に戻せる。直すと未取得に戻り選択に戻る
- [ ] #2 行のタイトルは取得済みならDLsiteのタイトル、そうでなければフォルダー名で、省略時はhoverで全文、2行目にフォルダーのパスが出る
- [ ] #3 DLsite列が未取得・取得中・取得済み・該当なし・失敗を語で出し、RJコードのない候補は「—」。行内の「修正」「再試行」ボタンが無く、失敗・該当なしの行は選び直して取得すれば取り直す
- [ ] #4 行方不明の作品と同じRJコードの行に「行方不明」のチップが出て、旧作品のタイトルと最後のパスはhoverで出る（旧タイトルが違うときだけ表にも出す）
- [ ] #5 ツールバーの絞り込み「問題あり」は押した時点の行で固定され、チェックを外しても行が消えない。「うちDLsite情報なし N」を押すとその行に絞り込める
<!-- AC:END -->
