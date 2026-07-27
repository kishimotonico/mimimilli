---
id: TASK-116
title: tagPrefixesのQuery→atom同期を廃止し参照経路を1本にする
status: To Do
assignee: []
created_date: '2026-07-27 01:58'
labels:
  - client
  - refactor
dependencies: []
priority: medium
ordinal: 124000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
useLibraryQueries.ts:170-174 が tagPrefixesQuery.data を useEffect で tagPrefixesAtom へコピーしている。server state を client state に複製する典型的な二重管理で、React 公式の "You Might Not Need an Effect" に該当する。

さらに参照経路が2本ある:
- LibraryView / AxisColumn などは useLibraryQueries の返り値から読む
- WorkGrid.tsx:119 や addressPathAtom（atoms.ts の派生 atom）は tagPrefixesAtom から読む

方針:
- 単一経路に統一する。tagPrefixes は server state なので TanStack Query を正とし、必要な場所で useQuery（同じ queryKey なのでリクエストは重複しない）を呼ぶのが素直
- addressPathAtom が atom を必要としている点が制約になるので、アドレスバーのパス生成を派生 atom から普通の関数 + コンポーネント側の計算に変える案も含めて検討する
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 tagPrefixesQuery.data を effect で atom へコピーする処理が存在しない
- [ ] #2 tagPrefixes の参照経路が1本になっている
- [ ] #3 軸ラベル・タグチップの表示（label / color / protected）とアドレスバーのパス表示が従来どおり
- [ ] #4 タグprefix定義の変更（設定画面）が各表示に従来どおり反映される
<!-- AC:END -->
