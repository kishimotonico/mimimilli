---
id: TASK-119
title: モーダルの閉じ経路（Escape・×・背景クリック）で挙動が食い違う問題を揃える
status: Done
assignee:
  - '@claude'
created_date: '2026-07-27 01:59'
updated_date: '2026-08-02 16:14'
labels:
  - client
  - ux
dependencies: []
priority: low
ordinal: 127000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ScanModal / SettingsModal は Escape のとき編集中フォームを優先して閉じる（モーダル自体は閉じない）が、×ボタンと背景クリックは onClose 直結で編集状態を無視する。同じ「閉じる」操作なのに経路で挙動が違う。

useDialogModal.ts のコメントに「各モーダルの既存backdrop挙動をそのまま渡す」と明記されており、意図的な現状維持として残されている。ただし経路ごとに違うのは利用者から見て理由のない差なので、どれかに揃えるべき。

決めること:
- 編集中に閉じ操作が来たとき、編集だけキャンセルするのか、確認するのか、破棄してモーダルを閉じるのか
- 決めた挙動を Escape / ×ボタン / 背景クリックの3経路すべてに適用する（useDialogModal の API も合わせて整理する）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Escape・×ボタン・背景クリックのいずれでも同じ挙動になる
- [x] #2 編集中の閉じ操作の扱いが ScanModal / SettingsModal で統一されている
- [x] #3 useDialogModal に経路ごとの挙動差を許すためのAPIが残っていない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
【2026-08-03 統括判断: 編集中の閉じ操作の扱い】3経路（Escape・×・背景クリック）すべてを「編集中なら編集のみキャンセルしてモーダルは開いたまま。非編集時はモーダルを閉じる」に統一する（レイヤーを1枚ずつ剥がすprogressive dismissal）。

根拠:
- Escapeが最前面のレイヤーから閉じるのは確立した慣例で、インライン編集を1レイヤーとみなす現行Escape挙動は妥当。これを基準に他2経路を揃える
- 「常に閉じて編集破棄」への統一は×・背景クリックが入力中テキストを黙って破壊する経路になり、安全性で劣る
- 確認ダイアログへの統一は1行のインライン編集（タイトル・フォルダーパス）に対して過剰で、閉じ操作の大半に摩擦を足す
- 統一案の最悪ケースは「×を2回押す」だけで実害がなく、挙動が予測可能

useDialogModal APIはonClose 1本に統一し、backdrop専用のonBackdropClose引数を廃止する（AC#3対応）。

【2026-08-03 実装完了】3経路をonClose 1本（progressive dismissal）へ統一。handleBackdropClickのonBackdropClose引数を廃止し、shouldCloseは経路共通の条件（保存中ガード）としてonClose内へ移設（RegisterWorkDialog/SmartFolderEditorModalは保存中ガードをonCloseに内包し、Escapeにも同じガードが効くようになった）。ScanModal/SettingsModalに×・背景クリックの編集中回帰テストを追加。Cursor(composer-2.5)へ委譲、統括レビュー済み。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Escape・×・背景クリックを「編集中は編集のみキャンセル、非編集時はモーダルを閉じる」へ統一。useDialogModalのAPIをonClose 1本に整理し、利用側8モーダルを追従。回帰テスト4件追加。pnpm check・pnpm test（605+444）全パス。
<!-- SECTION:FINAL_SUMMARY:END -->
