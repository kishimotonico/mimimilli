---
id: TASK-315
title: WorkspacePathと汎用Workspace media APIを定義する
status: Done
assignee:
  - '@kishimotonico'
created_date: '2026-08-12 11:31'
updated_date: '2026-08-12 13:02'
labels: []
dependencies: []
priority: medium
ordinal: 325000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
レビュー実施順4。現状、未登録ファイルの配信は音声だけ（server/src/routes/media.ts）で、画像は登録済み作品の相対パスが分かる場合のみ、PDF・text・videoは未対応。sharedにWorkspacePath（root相対・separator正規化済みのbranded type）とMediaKind/PreviewCapabilityの契約を定義し、WorkspaceResourceRefを受ける汎用media APIへ統一する。serverがroot内の安全な絶対パスへ解決し、MIME・Range・サイズ上限・preview可否を判定する。clientは絶対パスを保持しない。種別ごとの転送方法の違いはserver adapterに閉じる。未登録音声のresume・再生履歴は保存しない（2026-08-12決定、レビュー未決事項の既定案どおり）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 sharedにWorkspacePath・MediaKind・PreviewCapabilityの契約が定義されている
- [x] #2 WorkspaceResourceRefを受ける単一のmedia APIがroot内の絶対パスへ解決し、パストラバーサル・root外参照を拒否する
- [x] #3 音声・画像・PDF・text・videoのMIME判定・Range配信・サイズ上限がserver側で判定される
- [x] #4 既存の未登録音声配信経路が新APIへ統合され、旧経路が削除されている
- [x] #5 パストラバーサル拒否・Range・種別判定のテストがある
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. sharedにroot相対・portableなWorkspacePathとmedia契約を追加する。\n2. server adapterと単一workspace media routeを追加し、安全な解決・種別判定・Range・上限を実装する。\n3. 未登録音声の呼び出し側を新APIへ更新し、旧経路を削除する。\n4. 対象テストを追加し、各受け入れ条件を更新する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
統括判断により /api/fs の path とFiles再生queueも WorkspacePath へ一括置換した。metadataはFsEntryの mediaKind/preview を正本とし、text 1MiB・image 64MiB・PDF 256MiBの上限をserver契約に定義した。

Workspace mediaのreal/fixture adapter契約と、Range、416、traversal、text truncate、image/PDF上限、/api/fs root相対化の回帰テストを追加・更新した。

確認済み: bun test server/tests/real/fsAudio.test.ts server/tests/real/fsBrowse.test.ts server/tests/real/workUnregister.test.ts、bun test server/tests/fixtureMedia.test.ts server/tests/app.test.ts、shared/server/client の typecheck。

登録APIをWorkspacePathへ変更中。既存server workRegister結合テストは絶対path送信前提のため、root相対入力へ更新が必要。

登録preview/POST worksをWorkspacePath入力へ統一し、real・fixture・clientの選択状態もroot相対パスのみを保持するように修正した。text上限時は実ストリームも1 MiBで止めるようにした。検証: pnpm check:shared、pnpm check:server、pnpm check:client、bun test tests/real/workRegister.test.ts tests/real/workUnregister.test.ts tests/real/fsAudio.test.ts tests/real/fsBrowse.test.ts tests/fixtureMedia.test.ts tests/fixtureScenarios.test.ts（76件）すべて成功。旧fs-audio契約の参照はclient/server/sharedで0件。

変更37ファイルへ既定の oxfmt を適用した。shared/server/client check、関連server tests 76件、git diff --check は再成功。pnpm fmt:check は未変更・範囲外の docs/application-architecture-review-2026-08-12.md だけが既存フォーマット差分として残るため失敗し、そのファイルは変更していない。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
WorkspacePath と /api/media/workspace を正本として、Files・登録preview・POST worksの絶対パス入力を廃止した。real/fixtureでMIME、Range、416、traversal、非音声、各上限を検証し、text切り詰め時の実配信長も上限に揃えた。

変更ファイルは oxfmt 済みで、型検査・関連76テスト・diff検査を再実行済み。全体fmt:checkは未変更のdocs/application-architecture-review-2026-08-12.mdだけで失敗する。
<!-- SECTION:FINAL_SUMMARY:END -->
