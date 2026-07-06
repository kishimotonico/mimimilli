---
id: TASK-16
title: shell.cssの未参照クラス整理
status: To Do
assignee: []
created_date: '2026-07-05 17:59'
labels:
  - dx
dependencies: []
references:
  - docs/BACKLOG.md
priority: medium
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
shell.cssに未参照のCSSクラス（.mll-rtrk等のorphaned CSS、置換で未参照になった.mle-icbtn系）が残っている。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 shell.css内の未参照クラスを洗い出す
- [ ] #2 使われていないことを確認した上で削除する
- [ ] #3 削除後もビルド・表示に影響がないことを確認する
<!-- AC:END -->
