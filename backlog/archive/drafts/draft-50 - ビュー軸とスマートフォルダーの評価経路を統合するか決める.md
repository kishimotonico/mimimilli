---
id: DRAFT-50
title: ビュー軸とスマートフォルダーの評価経路を統合するか決める
status: Draft
assignee: []
created_date: '2026-08-06 04:59'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server/src/core/worksQuery.ts:125 の filterByView（固定ビューの switch 文）と、スマートフォルダー評価（core/smartFolder.ts の evalSmartFolder）が別経路の二層構造になっている。

出典: backlog/docs/doc-3（設計レビュー 2026-07-30）の「検討して見送った案」。当時の理由は「ビューは filterByView の約20行の単純 switch。統合にはルールエンジンへ日付・真偽値・enum比較の追加が必要で、統合コストが現状維持を上回る。固定ビュー/汎用ルールの二層が最もシンプル」。

コスト理由が挙げられている一方で「二層の方が単純」という設計上の理由も併記されているため、純粋な工数忌避とは言い切れない。現状で実害はなく、二層構造は破綻していない。

ただし将来ビュー種別を増やす、あるいはスマートフォルダーの表現力を上げる際に、境界の重複改修が必要になる可能性がある。変更コストを上げ続ける類の負債かどうかを、実際に増やす予定があるかも含めて判断したい。

要件が未定のためドラフト。着手を決めるなら、まず「二層を維持するか統合するか」を決める判断タスクを切ること。
<!-- SECTION:DESCRIPTION:END -->
