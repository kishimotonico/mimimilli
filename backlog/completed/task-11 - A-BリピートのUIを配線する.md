---
id: TASK-11
title: A-BリピートのUIを配線する
status: Done
assignee:
  - '@fable'
created_date: '2026-07-05 17:59'
updated_date: '2026-07-10 00:33'
labels:
  - player
dependencies: []
references:
  - docs/BACKLOG.md
priority: medium
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A-Bリピートのエンジン実装（setABPoint/clearABRepeat）は完了済みだが、UIからA点/B点の設定・解除を行う導線がまだない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 プレイヤーUIにA点/B点を設定するボタンとA-Bリピートを解除するボタンを追加する
- [x] #2 setABPoint/clearABRepeatが呼び出され、実際にA-B間でリピート再生されることをUI操作で確認できる
- [x] #3 A-Bリピート中であることが視覚的に分かる
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. A点/B点設定・解除ボタンをプレイヤーUIへ追加 2. setABPoint/clearABRepeatへ配線 3. リピート中の視覚状態(シークバー範囲表示等) 4. テスト・check
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnetエージェント実装、Fableがレビュー・実画面検証。A/Bボタン・時刻表示・シークバー範囲ハイライト・解除ボタンを確認。B点でA点へ戻る実ループ動作も確認できた（currentTimeがA-B間に留まる）。加えてFableがエンジン側の逆転バグを修正: B→Aの順で設定するとseekが暴発する問題を、setABPointでの区間入替+timeupdateのa<bガードで解消（usePlayer.ts）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
全画面プレイヤーにA-Bリピート行（A/B設定・時刻表示・範囲ハイライト・解除）を追加し配線。区間逆転時の入替ガードも追加。コミット e4a610a。
<!-- SECTION:FINAL_SUMMARY:END -->
