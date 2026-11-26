---
id: TASK-527
title: useDialogModal の cancel（Esc）がIME変換中にdialogを閉じないようにする
status: To Do
assignee: []
created_date: '2026-11-26 03:14'
updated_date: '2026-11-26 03:38'
labels:
  - client
  - bug
dependencies: []
priority: medium
ordinal: 646000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/src/shared/ui/useDialogModal.ts の handleCancel（75行目付近）が、IME変換中の Esc でも onClose を呼び、dialog が閉じる。cancel イベントの契機が変換中の Esc かを判別して閉じない処理が無い。CDP の合成イベントでの観測であり、実機の IME では未確認。再現: 入力欄のあるダイアログで日本語を変換中に Esc を押す。
UIプリミティブの置き換え（ADR-0043）でダイアログ・ポップオーバーを Ark UI へ寄せると、その置き換えで解消する可能性がある。関連: TASK-525、doc-10。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 IME変換中のEscでdialogが閉じない（実機または合成イベントで確かめる）
- [ ] #2 変換していない状態のEscは従来どおり onClose が呼ばれる
- [ ] #3 変換中のEscを扱うテストがある
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Windows の実 IME では変換中の Esc は key=Process（keyCode 229）で届き、key === "Escape" の判定に掛からないため、実機では再現しない（TASK-525 の IME 確認ページで確認）。対応なしとしてアーカイブする。
<!-- SECTION:NOTES:END -->
