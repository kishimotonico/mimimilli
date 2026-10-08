---
id: TASK-475
title: clientのモーダル外枠・作品詳細クエリ・ライブラリactionsを共通化する
status: Done
assignee:
  - '@mimi2'
created_date: '2026-10-02 11:40'
updated_date: '2026-10-08 06:44'
labels:
  - client
  - refactor
dependencies: []
priority: medium
ordinal: 533000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-10-02の点検で見つかったclientの重複と設計負債: (1) モーダル外枠のクラス列がConfirmDialog/ScanModal/SettingsModal/WorkEditDialog等11ファイルに手書き重複、見出しh2(text-[14px] font-semibold)も6箇所重複。開閉はuseDialogModalに集約済みだが見た目と構造の共通部品が無い (2) 作品詳細のuseQueryがuseSingleFileWorkTitle/WorkDetailPage/WorkDetailBreadcrumbs/useLibraryQueriesの4箇所で重複し workId ?? "" と workId! で型を黙らせている (3) features/library/model/useLibraryNavigation.ts:80-92 のuseLibraryViewが毎レンダー新しい関数を返し、WorkGrid/WorkListPane/WorkDetailPage/LibraryView/useLibrarySelectionCleanup/useLibrarySmartFolderEditorにeslint-disable（react-hooks/exhaustive-deps）が約8箇所波及 (4) handleTagClickの規則（Ctrl/Metaで追加、それ以外は置換）がLibraryView.tsx:105とWorkDetailPage.tsx:90に二重実装 (5) SettingsModal.tsx:126とRootConfigurationScreen.tsx:105がshared/ui/TextInputを使わず生inputで自前スタイル。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 モーダルの外枠・見出しがshared/uiの共通部品で描かれ、各モーダルに同じクラス列の手書きが残っていない
- [x] #2 作品詳細の取得が1つのフックに集約され、workIdの空文字代入や非nullアサーションが無い
- [x] #3 ライブラリのナビゲーションactionsが参照安定になり、それに起因するexhaustive-depsのeslint-disableが残っていない
- [x] #4 タグクリック時の追加/置換規則が1箇所で定義されている
- [x] #5 ルートフォルダーのパス入力がTextInputを使っている
- [x] #6 見た目に変化が無いことをpnpm test:smokeで確認し、pnpm check && pnpm test が通る
- [x] #7 作品詳細・タグ一覧・最終スキャン結果・診断のクエリ定義（key・queryFn・enabled）がentitiesのqueryOptionsで1箇所にあり、各所で手書きされていない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-02構造点検（doc-6・doc-7）より: (1) モーダル外枠は10ファイル11箇所（WorkEditDialogは2箇所）。shared/uiにsize variantとHeader/Footerを持つModalを作り、UnsavedChangesPromptの外枠もそれに寄せる。素のdialogをoxlintで禁止する・ConfirmDialogをn択へ拡張するのは必要になってからでよい。暗幕色・角丸・影はModalに吸収されるので別作業にしない（doc-7 cli-ui-1）。(2) 作品詳細だけでなく、getAllTags（3箇所）・getLastScanResult（4箇所）・scan diagnostics（3箇所）もkeyとqueryFnが手書きで重複している。useLibraryQueries.tsのコメントがTASK-188の衝突を理由にqueryOptions共有を掲げているのに3件にしか適用されていない。追加したACで扱う。lintでの直書き禁止までは不要（doc-7 cli-arch-3）。

2026-10-04 Codex(Astra)レビュー（tmp/structural-audit-2026-10-02/review-astra.md）を反映: モーダル外枠・作品詳細などのクエリ・ナビゲーションactionsは独立した責務なので、実装とレビューは単位を分ける。診断・last resultのqueryOptionsはTASK-485がAPI契約を変えるので、着手順を決めてから進める。

単位A（モーダル外枠）: Modal に寄せた結果、WorkEditDialog のヘッダー縦パディングが py-3→py-[14px]（約4px高くなる）、DlsiteBulkApplyDialog・RegisterWorkDialog・DlsiteEditor の最大高さが calc(100vh-48px)→calc(100vh-32px) に揃った。他モーダルとの統一として統括判断で受け入れ（AC#6 の「見た目に変化が無い」の例外）。幅は8種類の既存値をそのまま残した。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
モーダルの外枠と見出しを shared/ui の Modal・ModalHeader・ModalFooter に、作品詳細・タグ一覧のクエリ定義を entities の queryOptions に集約。ナビゲーション actions を参照安定にして exhaustive-deps の eslint-disable 7箇所を撤去、タグクリック規則を clickTag に1箇所化、パス入力を TextInput に。WorkEditDialog ヘッダー高さと3ダイアログの最大高さは他モーダルとの統一として変更（Notes）。 個別レビュー＋統合ブランチの横断レビュー、master への仮マージで pnpm check・test（server 951 / client 1339）・smoke 30 全通過、fixture でのブラウザ確認（再生・作品編集・スキャン・root 再設定）で崩れ・エラーなし。61e4b7bb で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
