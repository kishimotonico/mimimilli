---
id: TASK-281
title: 作品登録解除をクラッシュセーフにする（メタ先行削除の解消）
status: To Do
assignee: []
created_date: '2026-08-09 00:32'
labels: []
dependencies: []
priority: high
ordinal: 291000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexレビューで検出、Sonnet検証済みの未起票課題。server/src/adapters/real/workRegister.ts:87-103 の unregisterWork は正本の mimimilli.json を先に削除（deleteMetaFileOnly）してから repo.deleteWork を呼ぶ。deleteWork（workRepo.ts:1386-1393）は catalog delete×3 + user delete×1 を逐次 .run() する（トランザクション未使用）ため、DB削除の途中失敗で正本のメタだけが失われ、DBに部分レコードが残る。
- メタを同一ディレクトリへ atomic rename で退避し、DB削除のトランザクション成功後に実削除、失敗時は rename で戻すコマンドとして設計する
- deleteWork のDB削除を transaction / userTransaction（db.ts:42-50）でまとめる
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 unregisterの途中失敗でメタ正本が失われないこと（退避→DB削除→実削除の順序）がテストで担保されていること
- [ ] #2 deleteWork のDB削除がトランザクション化されていること
- [ ] #3 変更範囲のserverテストが通ること
<!-- AC:END -->
