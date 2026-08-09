---
id: TASK-256
title: createWorkの両分岐同一のデッドコードcatchを整理する
status: To Do
assignee: []
created_date: '2026-08-08 13:35'
updated_date: '2026-08-09 15:11'
labels: []
dependencies: []
ordinal: 266000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server/src/adapters/real/workMethods.ts の createWork にある catch (error) { if (error instanceof WorkRegisterError) throw error; throw error; } は両分岐とも単純再送出のデッドコード（TASK-209の分割前から存在し、移動時にそのまま維持された）。エラー変換の意図があったのか確認し、不要なら catch ごと削除する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 createWorkのcatch節から無意味な分岐が消え、挙動（送出される例外の型・メッセージ）が変わらないこと
- [x] #2 変更範囲のserverテストが通ること
<!-- AC:END -->
