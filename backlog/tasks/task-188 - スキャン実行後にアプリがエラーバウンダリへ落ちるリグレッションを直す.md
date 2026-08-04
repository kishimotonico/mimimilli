---
id: TASK-188
title: スキャン実行後にアプリがエラーバウンダリへ落ちるリグレッションを直す
status: In Progress
assignee:
  - impl-184
created_date: '2026-08-04 13:41'
updated_date: '2026-08-04 13:43'
labels: []
dependencies: []
priority: high
ordinal: 198000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ビジュアルテストの起点調査（2026-08-04）で判明した、ライブラリ再設計のリグレッション。実利用でスキャン後にアプリがクラッシュする実害バグ。

症状: スキャン結果ダイアログを開く操作でアプリ全体がエラーバウンダリ画面（「表示中にエラーが発生しました」）に落ちる。コンソールのエラーは以下。

  Objects are not valid as a React child (found: object with keys {items, total, stats}).
  If you meant to render a collection of children, use an array instead.

再現性100%。コミット 6a23169（TASK-179）から発生し、HEAD まで一貫して再現する。8779fb5（再設計着手前）では発生しない。

TASK-179 の差分に scan 関連ファイルの直接変更はないが、libraryPresentation.ts / useLibraryQueries.ts / DiscoveryDashboard.tsx / WorkCard.tsx / shared/src/work.ts / shared/src/library.ts が変更されている。エラーの {items, total, stats} という形状は useLibraryQueries.ts 周辺のクエリ結果（worksPage 系）と一致しており、クエリ結果オブジェクトをそのまま JSX の子として描画している箇所がある可能性が高い。スキャン実行時のライブラリのリフェッチ・再レンダリングが引き金になっていると見られる。

再発防止として、単体テストがこれをすり抜けた理由も確認すること。ビジュアルテスト（scan result dialog）だけが検知できていた。

対象: client/src/features/library/model/useLibraryQueries.ts 周辺 / スキャン結果ダイアログの描画経路 / client/tests/visual/library.spec.ts の scan result dialog
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スキャン結果ダイアログを開いてもエラーバウンダリに落ちず、正常に表示される
- [ ] #2 コンソールに Objects are not valid as a React child のエラーが出ない
- [ ] #3 ビジュアルテスト scan result dialog が通る
- [ ] #4 クエリ結果オブジェクトを誤って JSX の子として渡していた箇所が特定され、型で再発しない形に直っている
- [ ] #5 同種の描画事故を単体テストで検知できるようにテストが追加されている
- [ ] #6 pnpm check と pnpm test が通る
<!-- AC:END -->
