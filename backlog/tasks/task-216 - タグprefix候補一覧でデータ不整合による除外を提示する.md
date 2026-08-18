---
id: TASK-216
title: タグprefix候補一覧でデータ不整合による除外を提示する
status: To Do
assignee: []
created_date: '2026-08-06 15:43'
updated_date: '2026-08-18 22:57'
labels: []
dependencies: []
priority: low
ordinal: 226000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
listTagPrefixCandidates()（server/src/adapters/real/classificationMethods.ts:54-61）は listSummaries() を使うため、タグが不正な作品は候補の集計から除外される。除外は logDataIntegritySkips でログに出るだけで、戻り値が TagPrefixCandidate[] を直接返す設計のため dataIntegrityWarning を載せておらず、設定画面のタグprefix候補一覧（client/src/features/settings/ui/TagPrefixSettings.tsx）には何も表示されない。

TASK-205 では、隔離した作品を「件数と対象をログに記録し、UI のある経路ではユーザーに提示する」方針とし、エクスポート・スマートフォルダー・スキャン・DLsite一括取得の4経路に提示を実装した。この経路だけが未対応で残っている。

優先度が低い理由: この一覧はモーダル内の受動的なリストで、クエリ結果をそのまま描画するだけであり、「処理が完了した」ことを示すトースト等の導線が無い。そのため他経路のような『除外があったのに成功と表示される』という偽の成功表示は起きず、『候補が事前説明なく少なく見える』という見劣りに留まる。

対応するには envelope 形式（{ data, dataIntegrityWarning }）へのレスポンス形状変更が必要になるため、他の一覧系 API の返し方と揃えるかどうかを含めて検討する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 タグprefix候補一覧で、データ不整合により集計から除外された作品があることがユーザーに分かる
- [ ] #2 レスポンス形状の変更が、他の一覧系APIの返し方と整合している（揃えない判断をした場合は理由が記録されている）
- [ ] #3 除外が無い場合に余計な表示が出ない
<!-- AC:END -->
