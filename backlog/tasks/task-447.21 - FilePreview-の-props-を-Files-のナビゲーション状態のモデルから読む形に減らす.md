---
id: TASK-447.21
title: FilePreview の props を Files のナビゲーション状態のモデルから読む形に減らす
status: Done
assignee: []
created_date: '2026-09-11 08:05'
updated_date: '2026-09-11 08:43'
labels:
  - refactor
  - triage
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 489000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計負債の返上 第3回（tmp/uiux-triage-2026-09-11/followup-3.md の3）。FilePreview が master の 8 props から 18 props に増え、FilesView が nav 状態・クエリ・再生状態をばらして手渡ししている。2段で進める: 設計案を tmp/uiux-triage-2026-09-11/filepreview-design.md に書き、アドバイザーのレビューを経てから実装する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 設計案（18項目の分類、ナビゲーション状態のモデルの置き場所と API、再生状態のまとめ方、FilePreviewWorkActions の見直し）が filepreview-design.md にあり、アドバイザーの承認を得ている
- [x] #2 Files のナビゲーション状態が features/files/model の単一のモデル（例: useFilesNavigation）に置かれ、FilesView と FilePreview が同じものを読み、二重管理がない
- [x] #3 FilePreview の props が6個以下になり、FilePreviewWorkActions の props も同じ観点で減っている
- [x] #4 ファイル移動だけのコミットと中身を変えるコミットが分かれている
- [x] #5 挙動は変わらず、既存テストの期待値を変えていない（テストの統合・名前変更だけ許容し、タスクメモに列挙）。pnpm check（レイヤー境界含む）・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## ??/|| 既定値の洗い出し（レビュー指摘対応、修正コミットd93a727のついで）

新設・移設フック（useFilesBrowse/useFilesCwd/useIdentityConflict/useFilesPlayingMatcher）とFilePreview/FilePreviewWorkActions/FilesViewの差分にある `??`/`||` を全件確認した。

| 箇所 | 既定値 | 起こりうるか | 判断 |
|---|---|---|---|
| useFilesBrowse.ts:87 `folderEntries ?? entries`（playbackSourceEntries） | フォルダーの直下一覧 | 常時（previewEntryがファイルのとき） | 今回の修正そのもの。意味のある既定値、正当 |
| useFilesBrowse.ts:43 `cwdQuery.data?.entries ?? []` | 空配列 | クエリ未解決/エラー中は常に発生 | 正当な空（読み込み中は一覧がまだ無い） |
| useFilesBrowse.ts:65 `cwdQuery.data?.workId ?? null` | null（未登録扱い） | クエリ未解決中に一時的に発生 | 元のFilesView.tsxから無変更の既存挙動。読み込み中は「まだ分からない」を「未登録」として一瞬見せるが、解決後に再計算されるため実害なし。今回の変更範囲外 |
| useFilesBrowse.ts:51 `nav.relPath.slice(-1)[0] ?? rootLabel(root)` | ルートラベル | ルート表示時は常に発生 | 意図した挙動（ルートではタイトルがルート名になる）。既存のまま |
| useFilesBrowse.ts:72 `entries.find(...) ?? null` | null | .findがundefinedを返す全ケース | undefined→nullの型正規化のみ。到達時の意味は変わらない |
| useIdentityConflict.ts:19 `diagnosticsQuery.data?.diagnostics ?? []` | 空配列 | クエリ未解決/エラー中 | 正当な空（診断がまだ無い＝ID重複なし扱いで安全側） |
| useIdentityConflict.ts:31 `map.get(path) ?? null` | null | 対象パスに重複が無い全ケース | 「重複なし」の正しい表現そのもの |
| FilePreview.tsx:58 `(folderEntries ?? []).filter(...)`（audioFiles） | 空配列 | 到達せず（外側の`isDir ? ... : []`でisDir=true時のみ評価され、isDir=true→folderEntriesは必ずentries、null化しない） | TSがpreviewEntry.isDirとkind==="dir"の一致を型で追えないための防御的既定値。デッドコードだが無害、変更不要 |
| FilePreview.tsx:68 `entry?.workId ?? null`（workTitle算出） | null | 到達せず（isSingleFileWorkEntry true時点でentryは非null、workIdの型もstring\|nullでundefinedにならない） | 同上、型ガードの都合の防御コード。無害 |
| FilePreviewWorkActions.tsx:128 `identityConflict?.paths.filter(...) ?? []`（conflictingPaths） | 空配列 | 到達せず（使用箇所は`{identityConflict && ...}`配下のみ） | 計算自体は毎レンダー走るが、identityConflictがnullのときは描画されないため無害 |
| FilePreview.tsx:33 `useRootFolder() ?? "/"` | "/" | 設定クエリ未解決中 | TASK-447.28で全廃予定につき今回は対象外 |
| FilesView.tsx:91-92 cwdTitle/parentNameの`?? rootLabel(...)` | ルートラベル | ルート付近のパンくず表示時 | 既存のまま、意図した挙動 |

結論: 今回修正した`playbackSourceEntries`（旧`folderEntries ?? []`）以外に「本来起こらない状態を意味の違う空値で握りつぶしている」箇所は無かった。他は(1)クエリ未解決中の正当な空、(2)TSの型絞り込みが効かない箇所の到達不能な防御的デフォルト、(3)このタスクの変更前から存在する既存挙動、のいずれか。
<!-- SECTION:NOTES:END -->
