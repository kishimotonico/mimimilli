---
id: TASK-494
title: スキャン結果の作品タイトル編集でIME変換確定のEnterが保存になる
status: Done
assignee:
  - '@mimi2'
created_date: '2026-10-02 11:48'
updated_date: '2026-10-08 04:12'
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
- [x] #1 IME変換中のEnterでタイトルが保存されない
- [x] #2 変換確定後のEnterで保存され、Escapeで編集を取り消せる
- [x] #3 インライン編集のEnter/Escape/IME判定が共通のフックにあり、同じ形の入力欄がそれを使っている
- [x] #4 IME変換中のEnterで保存されないことがテストで確認されている
- [x] #5 pnpm check && pnpm test が通る
- [x] #6 pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-04 Codex(Astra)レビュー（tmp/structural-audit-2026-10-02/review-astra.md）を反映: 共通フックを使う入力欄は、少なくとも ScanResultWorksTable のタイトル編集と、isComposing を自前で判定している UnregisteredTab の編集入力。TagCombobox・TopBarの検索は形が違うので対象外。smokeではIMEを再現できないので、compositionを含む回帰テストはunitで書く。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
インライン編集の Enter/Escape/IME 判定を useInlineEditKeyDown に共通化し、ScanResultWorksTable・UnregisteredTab・TagPrefixRow で使用。isComposing と keyCode 229 の両方をテストで縛った。 個別レビュー＋統合ブランチの横断レビュー、feat/audit-sweep 先端で pnpm check・test 全通過、smoke 29/30（失敗1件は別プロジェクトの vite とのポート衝突で、単体再実行3/3通過）。17736da3 で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
