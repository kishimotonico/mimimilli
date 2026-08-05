---
id: TASK-204
title: タグの正規化済み不変条件をクライアント状態層まで通す
status: To Do
assignee: []
created_date: '2026-08-05 17:50'
labels: []
dependencies:
  - TASK-203
priority: high
ordinal: 214000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-203 で shared にタグの正規化済み不変条件（NormalizedTag）を導入したが、不変条件がクライアントの状態層で途切れている。あわせて、黙って値を捨てる実装を「コメントで説明すれば維持してよい」とした判断を見直す。

## 1. selectedTagsAtom が素の string[] のまま

client/src/features/library/model/atoms.ts の selectedTagsAtom（選択中フィルタの唯一の正本）が string[] を保持している。そのため libraryPresentation.ts の tagFilterGroupKey・axisOfFilterTag が、素の string を受け取って内部で normalizeTag してから parseBuiltinAxisTag へ渡す形を残している。

これは TASK-203 が排除しようとした「各所が正規化を忘れない規律への依存」が、クライアント状態層に残っているということである。selectedTagsAtom が NormalizedTag[] を保持すれば、末端の防御的正規化は不要になり、状態へ書き込む経路（URL 復元・値一覧のクリック・チップ操作）が唯一の正規化点になる。

境界は URL 復元（navigationUrl.ts の parseNavigationUrl）と、値選択時のタグ組み立て（buildFilterTag）に絞れるはずである。

## 2. normalizeTags の黙った除去

normalizeTags は正規化後に空になるタグと重複を警告なしに捨てる。TASK-203 ではこれを維持し、前提と理由をコメントに書く形で決着させた。

しかし AGENTS.md は「エラーは正しくハンドリングし問題を隠蔽しない」「過度なフォールバックは禁止」としており、コメントで説明することは黙って捨ててよい理由にならない。TASK-203 の受け入れ条件が「廃止されているか、前提と理由がコメントに明記されている」と逃げ道を残していたのが原因である。

改めて判断する。除去が必要な経路が実在するなら、そこはエラーとして扱えないか（外部連携でユーザーに提示すべき情報ではないか）を検討する。必要ないなら廃止する。重複排除は正規化とは別の関心事なので、必要な箇所で明示的に行う形へ分けることも選択肢とする。

## 判断の基準

実装コストや影響範囲の広さを理由に見送らないこと。アーキテクチャとコード品質の観点だけで判断する。

対象: client/src/features/library/model/atoms.ts / libraryPresentation.ts / libraryNavigationActions.ts / navigationUrl.ts / shared/src/work.ts / normalizeTags の呼び出し元
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 selectedTagsAtom が NormalizedTag[] を保持している
- [ ] #2 tagFilterGroupKey と axisOfFilterTag から内部の防御的正規化が取り除かれている
- [ ] #3 クライアント側で正規化を行うのが URL 復元とタグ組み立ての境界だけになっている
- [ ] #4 normalizeTags の黙った除去について、廃止するか、除去が必要な経路をエラー処理へ置き換えるかの判断が下され実装されている
- [ ] #5 重複排除が正規化と分離され、必要な箇所で明示的に行われている（分離しない判断をした場合はその理由が記録されている）
- [ ] #6 型エラーの回避目的の as キャストが導入されていない
- [ ] #7 pnpm check と pnpm test と pnpm test:visual が通る
<!-- AC:END -->
