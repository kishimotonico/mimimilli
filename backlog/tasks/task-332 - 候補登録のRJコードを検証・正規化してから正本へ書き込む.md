---
id: TASK-332
title: 候補登録のRJコードを検証・正規化してから正本へ書き込む
status: To Do
assignee: []
created_date: '2026-08-14 08:21'
labels: []
dependencies: []
priority: high
ordinal: 342000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexレビュー2026-08-14（マージe9c16fbの事後レビュー）の指摘。scanCandidateRegisterItemSchema（shared/src/scan.ts:31）のrjCodeがz.string().optional()で、クライアント（UnregisteredTab）にも検証・正規化がない。RJ123のような桁不足や全角文字がそのままmimimilli.jsonへ永続化され、DLsiteキャッシュは^(RJ|VJ)\d{6,8}$以外を拒否するため単発取得が500になり、一括取得もstatusがnoneのまま失敗を繰り返す。既存のdlsiteStatePatchSchemaと同等の形式検証・正規化（小文字→大文字など）を登録リクエストへ適用し、不正値が正本に入らないようにする。空文字（RJコードなしの明示）と省略（自動検出）の既存挙動は維持する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 登録APIが不正な形式のrjCodeを4xxで拒否し、正本のmimimilli.jsonへ書き込まれない
- [ ] #2 小文字rj等の表記ゆれが正規化されて保存される（dlsiteStatePatchSchemaと同等の規則）
- [ ] #3 空文字・省略の挙動（RJコードなしの明示・自動検出）が従来どおり動作する
- [ ] #4 UnregisteredTabの入力欄で不正な形式のとき登録前にエラーが分かる
- [ ] #5 形式検証を検証するテストがある
<!-- AC:END -->
