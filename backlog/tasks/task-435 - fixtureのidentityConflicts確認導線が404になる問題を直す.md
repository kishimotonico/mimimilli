---
id: TASK-435
title: fixtureのidentityConflicts確認導線が404になる問題を直す
status: Done
assignee: []
created_date: '2026-09-07 18:51'
updated_date: '2026-09-09 16:26'
labels:
  - test
  - fixture
  - server
dependencies: []
priority: low
ordinal: 456000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-428.5 のフォローアップ作業中に発見。fixture の `new-work` シナリオで、スキャンの要対応タブに出るID重複の「Filesで開く」導線のうち、`copies/RJ501001_...` 側が404になる。

構造:
- `server/src/adapters/fixture/state.ts` の `new-work` シナリオが identityConflicts の固定データとして `copies/RJ501001_夜更けの図書室で囁き朗読` という合成パスを持つ
- 一方 `server/src/adapters/fixture/data.ts` の `buildFsRoot()` が組み立てる `/fs` ツリーは library 直下に dlsite / fanza / viewer / readme.txt のみで、`copies` ノードが存在しない
- そのため「同一作品が2箇所にある」という体裁のうち、片方だけ実体を持たない状態になっている

本番では `copies/` 配下も実フォルダーとして存在するはずなので、実害は開発用 fixture に限られる。ただしこのプロジェクトは検証を fixture で行う方針なので、identityConflicts の確認導線が塞がっていると、今後このあたりを触るタスクが実機確認できない。

TASK-428.5 とは独立した既存の問題（該当2ファイルには 428.5 は一切触れていない）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 fixture の new-work シナリオで identityConflicts の両方のパスが Files ツリーに存在し、「Filesで開く」で開ける
- [x] #2 同種の不整合（固定データが参照するパスが buildFsRoot に無い）が他に無いか確認し、あれば同時に直すか記録する
- [x] #3 new-work と default シナリオで DataIntegrityWarningBanner が表示されない
- [x] #4 errors シナリオで DataIntegrityWarningBanner が表示される
<!-- AC:END -->







## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
関連（2026-09-08、TASK-428.9のレビューで判明）: dataIntegrityWarning を実装しているのは real アダプタのみで、fixture 側には実装が無い。そのため DataIntegrityWarningBanner を fixture で再現できず、これに触るタスクは実機確認ができない。identityConflicts の copies パス問題と同じく「fixture で確認導線が塞がっている」系統の問題なので、あわせて扱うか判断する。
<!-- SECTION:NOTES:END -->
