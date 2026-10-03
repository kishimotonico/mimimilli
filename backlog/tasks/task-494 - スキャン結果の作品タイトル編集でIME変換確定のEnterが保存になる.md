---
id: TASK-494
title: スキャン結果の作品タイトル編集でIME変換確定のEnterが保存になる
status: To Do
assignee: []
created_date: '2026-10-02 11:48'
labels:
  - client
  - bug
dependencies: []
documentation:
  - backlog/docs/doc-7
priority: medium
ordinal: 552000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ScanResultWorksTable.tsx のタイトル編集入力は onKeyDown で e.key === "Enter" なら saveTitle を呼び、isComposing を見ていない。日本語入力で変換を確定するEnterで、確定前の文字列のまま保存される。UnregisteredTab.tsx・TagCombobox.tsx・TopBar.tsx は isComposing を判定している。インライン編集のEnter/Escape/IME判定を共通のフックにし、同じ形の入力欄はそれを使う。詳細は doc-7 の cli-ui-6。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 IME変換中のEnterでタイトルが保存されない
- [ ] #2 変換確定後のEnterで保存され、Escapeで編集を取り消せる
- [ ] #3 インライン編集のEnter/Escape/IME判定が共通のフックにあり、同じ形の入力欄がそれを使っている
- [ ] #4 IME変換中のEnterで保存されないことがテストで確認されている
- [ ] #5 pnpm check && pnpm test が通る
<!-- AC:END -->
