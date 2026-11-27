---
id: TASK-528
title: ネイティブdialogを閉じたあと、開いた元の要素が消えていてもフォーカスをbodyに落とさない
status: To Do
assignee: []
created_date: '2026-11-26 03:14'
updated_date: '2026-11-27 13:58'
labels:
  - client
  - bug
dependencies:
  - TASK-531
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
複製ダイアログの『保存』で、dialog.close() の後の復帰とフォルダー遷移の再描画の間に約67ms BODY を経由する（TASK-529.1 の検証で観測）。このタスクで扱う

段階4の子タスク「ダイアログの置き換え」（TASK-531 配下、S4.1 完了後に起票）で解消する。このタスクはその完了時に AC#1〜#3 を確認して閉じる。複製ダイアログの保存で close 後の復帰とフォルダー遷移の再描画の間に約67ms BODY を経由する件（TASK-529.1 の検証で観測）は、原因が保存後の画面遷移なので、AC に含めない。ダイアログ置き換えの報告で測り直して扱いを決める
<!-- SECTION:NOTES:END -->
