---
id: TASK-507
title: DLsite適用のrjCodeを検証し、カバーをrevision照合の後にsymlinkを追従しない方式で確定する
status: Done
assignee:
  - '@sonnet'
created_date: '2026-10-18 13:36'
updated_date: '2026-11-07 10:55'
labels:
  - security
  - server
dependencies:
  - TASK-506
priority: medium
ordinal: 565000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Claude SecurityスキャンのF5追加修正とF10。DlsiteApplyBody.info.rjCodeが検証のない文字列で、dlsiteApplyはsourceRevisionの照合（dlsiteApply.ts:93）より前にカバーを最終名へ書いている（:82）。また dlsiteFetch.ts の cachedCover はキャッシュヒット・ミスの両分岐で writeFileSync(join(workDir, name)) の直書きで、作品フォルダーに置かれたsymlinkを追従してルート外のファイルを壊せ、拡張子もURLのpathnameから切り出している。meta.ts:249 の installBytes（wx一時ファイル→fsync→rename、非export）と同じ方式に寄せ、可能なら共用する。最終名をlstatしてから書く方式は検査後の差し替えが残るので採らない。方針の正は CLAUDE-SECURITY-20261016-133939/fix-instructions.md の B・D。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 DLsite適用でinfo.rjCodeがrjCodeFormatSchemaで検証され、不正な形式は400になる
- [x] #2 カバー画像はダウンロードして一時ファイルに置き、revision照合とカバー・メタの確定をメタ更新の排他区間でまとめて行う。ダウンロード中は排他しない。照合に失敗したら最終名のカバーは変わらず、一時ファイルも残らない
- [x] #3 カバーの書き込みはキャッシュヒット・ミスの両分岐とも、同じディレクトリに予測困難な名前の一時ファイルをwxで作り、fsyncしてからrenameする（installBytesと共通の実装）。renameに失敗したら既存の対象へ直接書かず失敗として扱う
- [x] #4 書き込み前に、親ディレクトリ（workDir）がルート内にあることをrealpathベースで確認し、外なら書かない
- [x] #5 apply-missingなど cachedCover の他の呼び出し経路も同じ書き込み方式を通る
- [x] #6 テストで、不正rjCodeの400、revision不一致でカバー不変かつ一時ファイルなし、最終名がルート外を指すsymlinkでも外部ファイルが不変、許可リスト外の拡張子を確認している
- [x] #7 最終名は jpg・jpeg・png・webp・gif の許可リストと固定のbasename（dlsite_cover.<ext>）から作る。URL末尾の拡張子は許可リストとの照合にだけ使い、許可リスト外の画像はカバーを書かない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
判断: (1) dlsiteWorkInfoSchema.rjCodeを共通でrjCodeFormatSchemaにした(適用・登録・取得結果が同じ形のinfoを使うため。RJ_CODE_PATTERN/rjCodeFormatSchemaはschema定義より前へ移動)。(2) installBytes/replaceWithRollback/AtomicReplaceOpsをserver/src/adapters/real/atomicFile.tsへ移し、writeTempFile/commitTempFile/removeTempFileに分解。メタとカバーが共用。(3) cachedCover/measureDownloadedCoverをstageCover(coverUrl, workDir, root, signal)に置換。許可リスト外拡張子・root外workDir・画像として読めない場合はnull(従来の測定失敗と同じ扱い: dlsiteApplyはnull、applyMissingはskipped、新規登録は「カバーの保存に失敗」)。commitは排他区間内(mutateVerifiedMetaSource)、新規登録・復元はscanner呼び出し直前にcommit。

レビュー修正: commitTempFileは通常ファイル/symlink以外(ディレクトリ等)を退避せず失敗扱い。カバー保存失敗はCoverSaveErrorで登録と適用を統一(いずれも500 internal)。既知の未対応: 登録失敗時に確定済みカバーが残る件と、メタ書き込み失敗時にカバーだけ更新される件は従来より悪化しないため今回は対応しない。

レビュー判断: カバー保存の失敗（許可リスト外・画像として読めない・ルート外・commit失敗）はCoverSaveErrorとし、onErrorで他のDLsite失敗と同じ502 errorに写像する。作品不在の404とは区別する。stageCoverの一時ファイル計測は自分がwxで作った直後のファイルなので resolveRegularFileWithin は通さない。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
DLsite適用・登録・apply-missingのrjCodeを形式検証し、カバーはwx作成の一時ファイルをrevision照合後にrenameで確定する方式にして最終名のsymlinkを追従しないようにした。カバー保存失敗は502。pnpm check && pnpm test と smoke で確認。
<!-- SECTION:FINAL_SUMMARY:END -->
