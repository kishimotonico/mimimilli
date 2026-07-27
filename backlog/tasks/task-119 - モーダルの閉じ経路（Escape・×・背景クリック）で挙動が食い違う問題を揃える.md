---
id: TASK-119
title: モーダルの閉じ経路（Escape・×・背景クリック）で挙動が食い違う問題を揃える
status: To Do
assignee: []
created_date: '2026-07-27 01:59'
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
- [ ] #1 Escape・×ボタン・背景クリックのいずれでも同じ挙動になる
- [ ] #2 編集中の閉じ操作の扱いが ScanModal / SettingsModal で統一されている
- [ ] #3 useDialogModal に経路ごとの挙動差を許すためのAPIが残っていない
<!-- AC:END -->
