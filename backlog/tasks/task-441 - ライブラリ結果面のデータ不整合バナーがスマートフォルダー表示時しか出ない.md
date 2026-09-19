---
id: TASK-441
title: ライブラリ結果面のデータ不整合バナーがスマートフォルダー表示時しか出ない
status: To Do
assignee: []
created_date: '2026-09-09 15:32'
labels:
  - ui
  - bug
dependencies: []
priority: medium
ordinal: 462000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-435 の検証中に発見（監査所見 findings-digest.md 2261行・2466行）。

server 側は通常のクエリでも dataIntegrityWarning を返している（server/src/adapters/real/workQueryRepository.ts:413-419 の queryWorks が toDataIntegrityWarning(skipped) を載せて返す）。一方 client/src/features/library/ui/LibraryView.tsx:334-340 で DataIntegrityWarningBanner の描画が activeSmartFolder の三項演算子の内側にあるため、スマートフォルダーを表示しているときしかバナーが出ない。全作品・タグ軸などの通常のライブラリ表示では result.dataIntegrityWarning が存在しても握り潰される。

adapter 種別を問わない client 側の描画ロジックの問題であり、fixture 固有ではない（統括がコードで確認済み）。

TASK-205 は隔離した作品を「件数と対象をログに記録し、UI のある経路ではユーザーに提示する」方針としており、本件はその方針から漏れている経路にあたる。タグprefix候補一覧の同種の欠落は TASK-216 で別途扱う（レスポンス形状の変更が必要な別問題）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 全作品表示・タグ軸表示など、スマートフォルダー以外のライブラリ結果面でも dataIntegrityWarning があればバナーが出る
- [ ] #2 除外が無い場合に余計な表示が出ない
- [ ] #3 errors シナリオの fixture で実機確認できる
<!-- AC:END -->
