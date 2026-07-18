---
id: TASK-16
title: shell.cssの未参照クラス整理
status: Done
assignee:
  - '@claude'
created_date: '2026-07-05 17:59'
updated_date: '2026-07-06 02:46'
labels:
  - dx
dependencies: []
references:
  - docs/BACKLOG.md
priority: medium
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
shell.cssに未参照のCSSクラス（.mll-rtrk等のorphaned CSS、置換で未参照になった.mle-icbtn系）が残っている。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 shell.css内の未参照クラスを洗い出す
- [x] #2 使われていないことを確認した上で削除する
- [x] #3 削除後もビルド・表示に影響がないことを確認する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. shell.css内の全クラス名を抽出し、client/src内の参照（className/文字列/テンプレートリテラル/動的組み立て）と突合
2. 未参照と判断したクラスを削除（動的に組み立てられる可能性があるものは保守的に残して報告）
3. pnpm check + pnpm test + test:visualで回帰確認、agent-browserで主要画面を目視
4. 実装はCodexへ委譲、検証とコミットはClaude
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装はCodexへ委譲、レビュー・検証・コミットはClaude。

- 削除は424行・削除のみ（プロパティ変更なし）。削除対象の全クラス名がclient/src内で未参照であることをrgで再確認
- 保守的残置: .mle-icbtn 本体（WorkDetail.tsxで参照中）と .mle-icbtn.is-muted（状態クラスのため）
- 検証: pnpm check / pnpm test 73件 / test:visual 6件 全通過。ビジュアルテスト対象外のポップアッププレイヤー・ファイルモードはagent-browserで目視確認
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
shell.cssから未参照クラス群（旧TopBar/AddressBar・旧カラム・旧プレビュー編集UI・旧セクション/FAB・Popup旧ボタン系）を削除、2787→2363行。check/test/visual全通過＋主要画面目視で回帰なしを確認（コミット 2174b2d）
<!-- SECTION:FINAL_SUMMARY:END -->
