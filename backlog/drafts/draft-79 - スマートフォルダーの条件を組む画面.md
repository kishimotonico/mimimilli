---
id: DRAFT-79
title: スマートフォルダーの条件を組む画面
status: Draft
assignee: []
created_date: '2026-11-21 20:25'
labels:
  - library
  - ui
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0040 で、条件を組む画面は TASK-516 の後の段階に回した。それまでの編集手段は上書きで足す・編集のダイアログで × で外す・別名で保存・削除と、API に条件の JSON を送ること（ADR-0040 の curl 例）だけで、or・除外（not）・長さ・この種類のタグが無い、などは画面から新しく組めない。保存できる形（ルート and＋1段の or / not(or)）を画面でどう見せ、どう組ませるかを決める。旧 SmartFolderEditorModal（カード式、TASK-516.6 で削除）は移植しない方針。下書きの条件の件数（preview API）もここで扱う。要件未定のためドラフト。
<!-- SECTION:DESCRIPTION:END -->
