---
id: TASK-332
title: 候補登録のRJコードを検証・正規化してから正本へ書き込む
status: Done
assignee: []
created_date: '2026-08-14 08:21'
updated_date: '2026-08-14 09:58'
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
- [x] #1 登録APIが不正な形式のrjCodeを4xxで拒否し、正本のmimimilli.jsonへ書き込まれない
- [x] #2 小文字rj等の表記ゆれが正規化されて保存される（dlsiteStatePatchSchemaと同等の規則）
- [x] #3 空文字・省略の挙動（RJコードなしの明示・自動検出）が従来どおり動作する
- [x] #4 UnregisteredTabの入力欄で不正な形式のとき登録前にエラーが分かる
- [x] #5 形式検証を検証するテストがある
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
scanCandidateRegisterItemSchemaのrjCodeがz.string().optional()で検証も正規化もなく、RJ123等の不正値がmimimilli.jsonへ永続化され、DLsiteキャッシュが^(RJ|VJ)\d{6,8}$以外を拒否するため取得が永続的に失敗していた。形式検証・正規化の正典としてshared/src/dlsite.tsにRJ_CODE_PATTERNとrjCodeFormatSchema（trim→regex→大文字化）を新設し、候補登録・作品編集PATCH・単発取得API・DLsiteキャッシュキー正規化の4箇所を同じ規則へ統一した（指摘は1箇所だったが正典化の過程で計4箇所の重複が判明）。TASK-325で確定した3状態（省略=自動検出／空文字=RJコードなしの明示／値=そのまま書込み）は維持。UnregisteredTabは入力確定時（blur/Enter）に検証し、不正なら行内エラーと登録ボタンの無効化で登録前に気づける。あわせてfixtureのresolveRegisteredRjCodeが空文字をnullへ潰しreal adapterと意味論が食い違っていた既存バグを修正し、TASK-325の契約がfixture経路で未検証だった穴を埋めるためHTTP境界からfixture保存まで実際に通す契約テストを追加した。検証: pnpm check通過、server 598 / client 811、smoke 15件全通過。
<!-- SECTION:FINAL_SUMMARY:END -->
