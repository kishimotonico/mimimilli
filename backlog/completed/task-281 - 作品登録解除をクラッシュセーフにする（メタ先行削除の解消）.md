---
id: TASK-281
title: 作品登録解除をクラッシュセーフにする（メタ先行削除の解消）
status: Done
assignee: []
created_date: '2026-08-09 00:32'
updated_date: '2026-08-09 02:21'
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
- [x] #1 unregisterの途中失敗でメタ正本が失われないこと（退避→DB削除→実削除の順序）がテストで担保されていること
- [x] #2 deleteWork のDB削除がトランザクション化されていること
- [x] #3 変更範囲のserverテストが通ること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
メタは同一ディレクトリへ .<name>.unregistering として atomic rename で退避し、DB削除の成功後に実削除、失敗時は rename で復元する。復元できない場合（正本パスが既に存在する等）は MetaUnregisterError で診断可能に失敗させ、黙って成功にしない。退避直後にプロセスが落ちた場合は次回の登録解除で findStagedMetaPlan が退避ファイルを検出して続行する。deleteWork の削除順は初回実装が user→catalog だったが、user削除成功・catalog削除失敗時に「catalogに作品行があるのにuser状態が無い」状態を作り、起動時整合性検査（db.ts:215-228）の致命エラーでDBが開けなくなるため catalog→user へ修正した。途中失敗で残るのは user 孤児行で、ADR-0008 が正常な状態として許容している。検証: pnpm check 成功、server 523 pass / 0 fail。DB削除失敗時のメタ復元と、catalog削除後のuser削除失敗の2ケースをテストで担保。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
unregisterWork のメタ先行削除を退避→DB削除→実削除の順へ設計し直し、失敗時は atomic rename で復元する。復元不能時は MetaUnregisterError で失敗させる。deleteWork のDB削除を catalog・user 各トランザクションでまとめ、途中失敗が起動時整合性検査の致命エラーにならない catalog→user の順とした。pnpm check と server 523 テストで検証。
<!-- SECTION:FINAL_SUMMARY:END -->
