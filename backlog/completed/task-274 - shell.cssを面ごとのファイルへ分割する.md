---
id: TASK-274
title: shell.cssを面ごとのファイルへ分割する
status: Done
assignee: []
created_date: '2026-08-08 21:21'
updated_date: '2026-08-09 02:12'
labels: []
dependencies: []
priority: medium
ordinal: 284000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出。client/src/styles/shell.css が約3400行の単一CSS。
Codexレビュー反映: mle- プレフィックスはframe・preview・player・filesで共有されており、「面別分割」と「prefixから定義先を予測」は両立しない。分割は base/frame・library・files・player・preview/shared 等の所有境界を明記して行い、import順（カスケード順序）も明文化する。プレフィックス由来の予測可能性はACにしない。
見た目の変更はゼロが前提（純粋なファイル分割）だが、現行smokeは視覚差分を検出しないため「見た目無変化」の完全担保はACにせず、既存smokeの操作回帰なしを確認する。docs/design-system.md の規約に従うこと。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 clientのcheckが通ること
- [x] #2 所有境界とimport順（カスケード順序）が明文化された分割になっていること
- [x] #3 既存smokeが全て通り操作回帰がないこと
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
所有境界での分割とソース順の保存が衝突したため、順序の保存を優先して各面を複数ファイルへ分けた（frame-a/b/c・library-a〜e・files-a/b/c・preview-a/b・player-a・shared-a〜d の19ファイル＋index.css）。ファイル名の面プレフィックスで所有境界を、index.css の @import 順でカスケード順を表現している。検証は既存smokeに加え、ビルド出力CSSを分割前後で比較して差分ゼロを機械的に確認した（規則数1395で一致、宣言も完全一致）。@layer components は6→19ブロックに分かれるが、同名レイヤーは統合され順序はimport順で決まるため影響なし。base 相当は元から @layer base に包まれていたので優先度の変化はない。textSelection.test.ts は shell/ 配下の全CSSを連結して検査する形へ変更（アサーションは不変）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
3401行の shell.css を所有境界ごとの19ファイルへ分割し、index.css の @import 順でレイヤー割り当てとカスケード順を明文化した。ソース順を保存したためビルド出力CSSは分割前と完全一致（diff差分ゼロを実測）。client 103ファイル/781テストとsmoke 10件が全パス。
<!-- SECTION:FINAL_SUMMARY:END -->
