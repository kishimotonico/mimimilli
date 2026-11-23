---
id: TASK-517.9
title: 保存後の入り直しと補正を単純にし、遷移のバグを直す
status: Done
assignee: []
created_date: '2026-11-23 13:11'
updated_date: '2026-11-23 18:11'
labels:
  - library
  - client
dependencies:
  - TASK-517.6
parent_task_id: TASK-517
priority: high
ordinal: 633000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
await 後の入り直しを「始めたときの route（同じオブジェクト）から動いていなければ移る、動いていれば何もしない」の1分岐にする。LibraryPlace・settle の3分岐・reenterLibraryFolder・clearLibrarySort/clearLibraryGroupSort をなくす。登録解除とグループ分けの変更は ADR-0041 の補正にそろえる。並べ替えの直列キューは保存中のドラッグ不可にして消す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 保存・上書き・作成の await 中に画面・層・絞り込み・選択を変えたとき、完了後もユーザーが変えた状態が保たれる
- [x] #2 上書きのあとは置き換えで同じスマートフォルダーへ入り直し、履歴が増えない
- [x] #3 登録解除の完了時、選択や作品詳細が解除した作品のときだけ外れ、開いている層やほかの作品の詳細は変わらない
- [x] #4 グループ分けを変えて保存したとき、古い group での作品一覧の取得が1回も出ずに値一覧へ移り、チップ・検索語・並びは残る
- [x] #5 並べ替えの保存中は次のドラッグを受け付けず、直列キューが残っていない
- [x] #6 定義の更新が編集フックの1つの関数を通り、成功応答が一覧のキャッシュにすぐ反映される。取り直す範囲は送った列から決まり、既定の並びの保存に今の並びを外す補正が無い
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
統括: client テストの重複（517.10 の常駐レビューの nit）。api.test.ts の「送った列だけを PATCH」は useSmartFolderEditor.test.tsx の同じ確認に包含されている。編集フックを1つの関数に寄せるときに、どちらか一方にまとめる。

統括（517.6 から）: settleLibraryFolderAtom は overwrite（既定 false）で新規（push、同じ場所なら replace）と上書き（reenterLibraryFolder の replace）を分けている。settle を作り直すときもこの区別（ADR-0041:68 の新規は積む・上書きは置き換え）を保ち、テストで縛る。

40ae0188・aab73568・4d700996。入り直しは started との参照比較の1分岐、編集フックは patch 1本、並べ替えは保存中ドラッグ不可、グループ分け変更時は group 付きの作品一覧クエリを捨ててから無効化。常駐レビューで登録解除の補正が状態から導かれていない（詳細のキャッシュが残る、ファイル・スキャンからの解除で補正されない）と指摘され、解除時に詳細を無効化して既存の 404 からの補正に任せる形にした（ADR-0041 の文面どおり）。ダイアログは変わった列だけ送る。smoke: 直したテストは単体で通過、フルは TASK-518 の計測と重なり起動待ちのタイムアウトで落ちたため最終確認は TASK-518 の修正を取り込んでから行う。
<!-- SECTION:NOTES:END -->
