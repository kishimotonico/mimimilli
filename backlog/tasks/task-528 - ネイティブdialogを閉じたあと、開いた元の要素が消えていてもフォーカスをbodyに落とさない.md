---
id: TASK-528
title: ネイティブdialogを閉じたあと、開いた元の要素が消えていてもフォーカスをbodyに落とさない
status: To Do
assignee: []
created_date: '2026-11-26 03:14'
labels:
  - client
  - bug
dependencies: []
priority: medium
ordinal: 647000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
メニュー項目などから dialog を開き、メニューがアンマウントされた状態で閉じると、フォーカスが body に落ちる。useDialogModal（client/src/shared/ui/useDialogModal.ts 31〜33行目、64〜68行目）は開いた時点の activeElement を復帰先として覚え、isConnected でないときの代わりの戻し先を持たない。Base UI・Ark UI 両試作のS4（ネイティブ版）で、Esc・キャンセル・実行のどれで閉じても body になることを確認済み。
UIプリミティブの置き換え（ADR-0043）でダイアログ・ポップオーバーを Ark UI へ寄せると、その置き換えで解消する可能性がある。関連: TASK-525、doc-10。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 復帰先の要素が消えていたら、呼び出し側が指定した戻し先へフォーカスが戻る
- [ ] #2 復帰先が残っている場合は従来どおりその要素へ戻る
- [ ] #3 復帰先が消えた場合のテストがある
<!-- AC:END -->
