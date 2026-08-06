---
id: TASK-206
title: サーバー更新の状態管理とエラー提示をuseMutationへ統一する
status: In Progress
assignee: []
created_date: '2026-08-06 04:57'
updated_date: '2026-08-06 05:01'
labels: []
dependencies: []
priority: high
ordinal: 216000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
同じ「サーバーを更新して結果をユーザーへ返す」という一つの問題に対して、コードベース内で複数の対処が併存している。各機能を実装した時点で「近くにある一番手っ取り早い方法」「1個のフックを新設するほどでもない」という影響範囲を絞る判断が積み重なった結果で、正解が同じコードベースにあるのに後発が倣わなかった形になっている。

## 1. 手書き busy-state + try/catch が6箇所

正しい実装例は client/src/features/settings/ui/TagPrefixSettings.tsx:56-84 で、create/update/delete それぞれに独立した useMutation を持ち .isPending / onError をそのまま使っている。追加の state もローカルエラー変数も要らない。

一方で以下6箇所は useState の busy フラグとエラー文言を持ち try/catch/finally で挙動を再現している。

- client/src/features/scan/ui/ScanModal.tsx:141-158（handleSaveTitle）
- client/src/features/files/ui/FilePreview.tsx:87-120（handleUnregister / openRegisterDialog）
- client/src/features/files/ui/RegisterWorkDialog.tsx:58-77,118-143（dlsiteBusy / dlsiteError / submitBusy / submitError の4つの state ペアを自前管理）
- client/src/features/library/ui/preview/WorkEditDialog.tsx:40-50
- client/src/features/library/ui/preview/WorkMetadataActions.tsx:44-53
- client/src/features/library/ui/preview/useWorkTagEditor.ts:69-80

## 2. 単一の共有 mutation を無関係な3操作で使い回している

useLibraryQueries.ts の useLibraryPatchWorkMutation 1個が、LibraryView.tsx:158-161 の handlePatchWork を経由してタイトル編集・ブックマーク切替・タグ編集という互いに無関係な3操作に共有されている。各 UI は「自分が触っている項目だけローディング表示したい」という要求を持つため、共有の isPatching では足りず、3箇所が isTitleSaving / isBookmarkSaving / isTagSaving というほぼ同じ形のローカル state を継ぎ足して辻褄を合わせている。

関心事ごとに独立した useMutation を持てば .isPending / .error / .reset() がそのまま使え、3箇所のローカル state・try/catch・エラー文言はすべて不要になる。

## 3. エラー通知の手段が4系統に分裂し、大半の失敗が画面に出ない

app/model/errorToastAtom.ts と常設の app/ui/GlobalToast.tsx という正規の仕組みがあるのに、使っているのは features/files/ui/FilePreview.tsx の1箇所だけ。

- console.error で終わり（ユーザーには何も出ない）: useLibraryQueries.ts:267（作品PATCH失敗）、app/App.tsx:86（再生失敗）、features/library/ui/LibraryView.tsx:92（スマートフォルダー保存失敗）、features/setup/ui/SetupScreen.tsx:36（初回スキャン失敗）
- 完全に無言: app/App.tsx:122-135 の handleExport が catch { /* ignore */ } で、ボタンを押しても何も起きないように見える
- ローカル state でインラインエラーを各自で自作: WorkEditDialog / WorkMetadataActions / useWorkTagEditor / RegisterWorkDialog の4箇所

トーストの仕組み自体は既にあるので追加実装は不要。1 と 2 を直せば useMutation の .error を表示するだけになり、この分裂も同時に収束する。3つは根が同じ。

## 方針

即座のフィードバックが要る操作（フォーム内の更新）はコンポーネントローカルの useMutation の .error をインライン表示し、バックグラウンド寄りの操作（再生開始・エクスポート・初回スキャン）は errorToastAtom を使う、という切り分けを決めたうえで全経路をそこへ寄せる。

判断の基準: 実装コストや影響範囲の広さを理由に見送らないこと。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 上記6箇所の手書き busy-state + try/catch が useMutation へ置き換わり、useState によるビジー管理とエラー文言の自前保持が残っていない
- [ ] #2 タイトル編集・ブックマーク切替・タグ編集がそれぞれ独立した mutation を持ち、共有の isPatching に依存した継ぎ足しの state が削除されている
- [ ] #3 ユーザー操作の失敗が握りつぶされる経路が無くなり、console.error のみ・完全無言の箇所がユーザーへ提示される形になっている
- [ ] #4 エラー提示の方式が「フォーム内はインライン、バックグラウンド操作はトースト」の2種類に整理され、それ以外の自作方式が残っていない
- [ ] #5 handleExport の catch による無言の握りつぶしが解消されている
- [ ] #6 pnpm check と pnpm test と pnpm test:visual が通る
<!-- AC:END -->
